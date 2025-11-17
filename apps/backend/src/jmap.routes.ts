import { v } from "@gebna/validation";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";

import { getDB, TransactionInstance } from "./db";
import {
	accountMessageTable,
	addressTable,
	changeLogTable,
	emailSubmissionTable,
	identityTable,
	jmapStateTable,
	mailboxMessageTable,
	mailboxTable,
	messageAddressTable,
	messageTable,
	threadTable,
} from "./db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE, JMAP_MAIL } from "./lib/jmap/constants";
import { attachUserFromJwt, requireJWT, type JMAPHonoAppEnv } from "./lib/jmap/middlewares";
import { createOutboundTransport } from "./lib/outbound";
import { DeliveryStatusRecord } from "./lib/types";

const JmapMethodCallSchema = v.tuple([
	v.string(), // name
	v.record(v.string(), v.unknown()), // args
	v.string(), // tag
]);

const JmapRequestSchema = v.object({
	using: v.array(v.string()),
	methodCalls: v.array(JmapMethodCallSchema),
});

type JmapRequest = v.InferOutput<typeof JmapRequestSchema>;
type JmapMethodResponse = [string, Record<string, unknown>, string];

type JmapHandler = (
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
) => Promise<JmapMethodResponse>;

type JmapStateType = "Email" | "Mailbox" | "Thread";

async function getAccountState(
	db: ReturnType<typeof getDB>,
	accountId: string,
	type: JmapStateType
): Promise<string> {
	const [row] = await db
		.select({ modSeq: jmapStateTable.modSeq })
		.from(jmapStateTable)
		.where(and(eq(jmapStateTable.accountId, accountId), eq(jmapStateTable.type, type)))
		.limit(1);

	if (!row) return "0";
	return String(row.modSeq);
}

async function getGlobalAccountState(
	db: ReturnType<typeof getDB>,
	accountId: string
): Promise<string> {
	const rows = await db
		.select({ modSeq: jmapStateTable.modSeq })
		.from(jmapStateTable)
		.where(eq(jmapStateTable.accountId, accountId));

	if (!rows.length) return "0";
	const max = rows.reduce((m, r) => (r.modSeq > m ? r.modSeq : m), rows[0]!.modSeq);
	return String(max);
}

function ensureAccountAccess(
	c: Context<JMAPHonoAppEnv>,
	accountIdArg: string | undefined
): string | null {
	const accountId = c.get("accountId");
	const effective = accountIdArg ?? accountId;
	if (effective !== accountId) return null;
	return accountId;
}

type ChangesResult = {
	oldState: string;
	newState: string;
	created: string[];
	updated: string[];
	destroyed: string[];
	hasMoreChanges: boolean;
};

async function getChanges(
	db: ReturnType<typeof getDB>,
	accountId: string,
	type: JmapStateType,
	sinceState: string,
	maxChanges: number
): Promise<ChangesResult> {
	const since = Number(sinceState);
	if (!Number.isFinite(since) || since < 0) {
		throw Object.assign(new Error("invalid sinceState"), { jmapType: "cannotCalculateChanges" });
	}

	const rows = await db
		.select({
			objectId: changeLogTable.objectId,
			modSeq: changeLogTable.modSeq,
		})
		.from(changeLogTable)
		.where(
			and(
				eq(changeLogTable.accountId, accountId),
				eq(changeLogTable.type, type),
				sql`${changeLogTable.modSeq} > ${since}`
			)
		)
		.orderBy(changeLogTable.modSeq)
		.limit(maxChanges + 1);

	if (!rows.length) {
		const newState = await getAccountState(db, accountId, type);
		return {
			oldState: sinceState,
			newState,
			created: [],
			updated: [],
			destroyed: [],
			hasMoreChanges: false,
		};
	}

	const hasMoreChanges = rows.length > maxChanges;
	const slice = hasMoreChanges ? rows.slice(0, maxChanges) : rows;

	// For now, treat all as "updated" – inbound path only creates, future set-code can refine.
	const updatedIds = Array.from(new Set(slice.map((r) => r.objectId)));

	const newState = String(slice[slice.length - 1]!.modSeq);

	return {
		oldState: sinceState,
		newState,
		created: [], // TODO: distinguish when you add op column
		updated: updatedIds,
		destroyed: [], // TODO: fill when you add deletion logging
		hasMoreChanges,
	};
}

async function handleEmailChanges(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);
	const accountIdArg = args.accountId as string | undefined;
	const effectiveAccountId = ensureAccountAccess(c, accountIdArg);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const sinceState = (args.sinceState as string | undefined) ?? "0";
	const maxChangesArg = args.maxChanges as number | undefined;
	const limitFromConstraints = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	const maxChanges =
		typeof maxChangesArg === "number" && Number.isFinite(maxChangesArg) && maxChangesArg > 0
			? Math.min(maxChangesArg, limitFromConstraints)
			: limitFromConstraints;

	try {
		const changes = await getChanges(db, effectiveAccountId, "Email", sinceState, maxChanges);

		return [
			"Email/changes",
			{
				accountId: effectiveAccountId,
				oldState: changes.oldState,
				newState: changes.newState,
				hasMoreChanges: changes.hasMoreChanges,
				created: changes.created,
				updated: changes.updated,
				destroyed: changes.destroyed,
			},
			tag,
		];
	} catch (err) {
		console.error("Email/changes error", err);
		return ["error", { type: "serverError" }, tag];
	}
}

async function handleThreadChanges(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);
	const accountIdArg = args.accountId as string | undefined;
	const effectiveAccountId = ensureAccountAccess(c, accountIdArg);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const sinceState = (args.sinceState as string | undefined) ?? "0";
	const maxChangesArg = args.maxChanges as number | undefined;
	const limitFromConstraints = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	const maxChanges =
		typeof maxChangesArg === "number" && Number.isFinite(maxChangesArg) && maxChangesArg > 0
			? Math.min(maxChangesArg, limitFromConstraints)
			: limitFromConstraints;

	try {
		const changes = await getChanges(db, effectiveAccountId, "Thread", sinceState, maxChanges);

		return [
			"Thread/changes",
			{
				accountId: effectiveAccountId,
				oldState: changes.oldState,
				newState: changes.newState,
				hasMoreChanges: changes.hasMoreChanges,
				created: changes.created,
				updated: changes.updated,
				destroyed: changes.destroyed,
			},
			tag,
		];
	} catch (err) {
		console.error("Thread/changes error", err);
		return ["error", { type: "serverError" }, tag];
	}
}

async function handleMailboxChanges(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);
	const accountIdArg = args.accountId as string | undefined;
	const effectiveAccountId = ensureAccountAccess(c, accountIdArg);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const sinceState = (args.sinceState as string | undefined) ?? "0";
	const maxChangesArg = args.maxChanges as number | undefined;
	const limitFromConstraints = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	const maxChanges =
		typeof maxChangesArg === "number" && Number.isFinite(maxChangesArg) && maxChangesArg > 0
			? Math.min(maxChangesArg, limitFromConstraints)
			: limitFromConstraints;

	try {
		const changes = await getChanges(db, effectiveAccountId, "Mailbox", sinceState, maxChanges);

		return [
			"Mailbox/changes",
			{
				accountId: effectiveAccountId,
				oldState: changes.oldState,
				newState: changes.newState,
				hasMoreChanges: changes.hasMoreChanges,
				created: changes.created,
				updated: changes.updated,
				destroyed: changes.destroyed,
			},
			tag,
		];
	} catch (err) {
		console.error("Mailbox/changes error", err);
		return ["error", { type: "serverError" }, tag];
	}
}

async function handleSession(c: Context<JMAPHonoAppEnv>) {
	const user = c.get("user");
	const userId = user.id;
	const accountId = c.get("accountId");
	const db = getDB(c.env);

	const globalState = await getGlobalAccountState(db, accountId);

	const session = {
		capabilities: JMAP_CONSTRAINTS,
		accounts: {
			[accountId]: {
				name: "Gebna Mail",
				isPersonal: true,
				isReadOnly: false,
				accountCapabilities: {
					[JMAP_CORE]: {},
					[JMAP_MAIL]: {},
				},
			},
		},
		primaryAccounts: {
			[JMAP_CORE]: accountId,
			[JMAP_MAIL]: accountId,
		},
		username: userId,
		apiUrl: c.env.BASE_API_URL,
		downloadUrl: `${c.env.BASE_API_URL}${c.env.JMAP_DOWNLOAD_PATH}`,
		uploadUrl: `${c.env.BASE_API_URL}${c.env.JMAP_UPLOAD_PATH}`,
		eventSourceUrl: null,
		state: globalState,
	};

	return c.json(session);
}

async function handleEmailGet(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);

	const accountIdArg = args.accountId as string | undefined;
	const effectiveAccountId = ensureAccountAccess(c, accountIdArg);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}
	const state = await getAccountState(db, effectiveAccountId, "Email");

	const ids = (args.ids as string[] | undefined) ?? [];
	if (!ids.length) {
		return ["Email/get", { accountId: effectiveAccountId, state, list: [], notFound: [] }, tag];
	}

	const rows = await db
		.select({
			emailId: accountMessageTable.id,
			messageId: messageTable.id,
			threadId: accountMessageTable.threadId,
			internalDate: accountMessageTable.internalDate,
			subject: messageTable.subject,
			snippet: messageTable.snippet,
			sentAt: messageTable.sentAt,
		})
		.from(accountMessageTable)
		.innerJoin(messageTable, eq(accountMessageTable.messageId, messageTable.id))
		.where(
			and(
				eq(accountMessageTable.accountId, effectiveAccountId),
				inArray(accountMessageTable.id, ids)
			)
		);

	if (!rows.length) {
		return ["Email/get", { accountId: effectiveAccountId, state, list: [], notFound: ids }, tag];
	}

	const mailboxRows = await db
		.select({
			emailId: mailboxMessageTable.accountMessageId,
			mailboxId: mailboxMessageTable.mailboxId,
		})
		.from(mailboxMessageTable)
		.where(
			inArray(
				mailboxMessageTable.accountMessageId,
				rows.map((r) => r.emailId)
			)
		);

	const mailboxMap = new Map<string, string[]>();
	for (const row of mailboxRows) {
		const arr = mailboxMap.get(row.emailId) ?? [];
		arr.push(row.mailboxId);
		mailboxMap.set(row.emailId, arr);
	}

	const addressRows = await db
		.select({
			messageId: messageAddressTable.messageId,
			kind: messageAddressTable.kind,
			position: messageAddressTable.position,
			email: addressTable.email,
			name: addressTable.name,
		})
		.from(messageAddressTable)
		.innerJoin(addressTable, eq(messageAddressTable.addressId, addressTable.id))
		.where(
			inArray(
				messageAddressTable.messageId,
				rows.map((r) => r.messageId)
			)
		);

	type JmapEmailAddress = { email: string; name?: string | null };
	const addrsByMsg = new Map<string, Record<string, JmapEmailAddress[]>>();

	for (const row of addressRows) {
		const perMsg = addrsByMsg.get(row.messageId) ?? {};
		const list = perMsg[row.kind] ?? [];
		list[row.position] = {
			email: row.email,
			name: row.name,
		};
		perMsg[row.kind] = list;
		addrsByMsg.set(row.messageId, perMsg);
	}

	const list = rows.map((row) => {
		const mailboxes = mailboxMap.get(row.emailId) ?? [];
		const addrKinds = addrsByMsg.get(row.messageId) ?? {};
		const from = addrKinds["from"] ?? [];
		const to = addrKinds["to"] ?? [];
		const cc = addrKinds["cc"] ?? [];
		const bcc = addrKinds["bcc"] ?? [];

		return {
			id: row.emailId,
			threadId: row.threadId,
			mailboxIds: mailboxes,
			subject: row.subject,
			sentAt: row.sentAt ? new Date(row.sentAt).toISOString() : null,
			receivedAt: new Date(row.internalDate).toISOString(),
			preview: row.snippet,
			from,
			to,
			cc,
			bcc,
		};
	});

	const foundIds = new Set(list.map((e) => e.id));
	const notFound = ids.filter((id) => !foundIds.has(id));

	return [
		"Email/get",
		{
			accountId: effectiveAccountId,
			state,
			list,
			notFound,
		},
		tag,
	];
}

async function handleEmailQuery(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);
	const accountIdArg = args.accountId as string | undefined;
	const effectiveAccountId = ensureAccountAccess(c, accountIdArg);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}
	const queryState = await getAccountState(db, effectiveAccountId, "Email");

	const limit = typeof args.limit === "number" ? args.limit : 50;

	const rows = await db
		.select({
			emailId: accountMessageTable.id,
		})
		.from(accountMessageTable)
		.where(eq(accountMessageTable.accountId, effectiveAccountId))
		.orderBy(desc(accountMessageTable.internalDate))
		.limit(limit);

	const ids = rows.map((r) => r.emailId);

	return [
		"Email/query",
		{
			accountId: effectiveAccountId,
			queryState,
			canCalculateChanges: false,
			ids,
			position: 0,
			total: ids.length,
		},
		tag,
	];
}

async function handleThreadGet(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);

	const accountIdArg = args.accountId as string | undefined;
	const effectiveAccountId = ensureAccountAccess(c, accountIdArg);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}
	const state = await getAccountState(db, effectiveAccountId, "Thread");

	const ids = (args.ids as string[] | undefined) ?? [];
	if (!ids.length) {
		return ["Thread/get", { accountId: effectiveAccountId, state, list: [], notFound: [] }, tag];
	}

	const rows = await db
		.select({
			threadId: threadTable.id,
			emailId: accountMessageTable.id,
		})
		.from(threadTable)
		.innerJoin(accountMessageTable, eq(threadTable.id, accountMessageTable.threadId))
		.where(and(eq(threadTable.accountId, effectiveAccountId), inArray(threadTable.id, ids)));

	const byThread = new Map<string, string[]>();
	for (const row of rows) {
		const arr = byThread.get(row.threadId) ?? [];
		arr.push(row.emailId);
		byThread.set(row.threadId, arr);
	}

	const list = Array.from(byThread.entries()).map(([threadId, emailIds]) => ({
		id: threadId,
		emailIds,
	}));

	const foundIds = new Set(list.map((t) => t.id));
	const notFound = ids.filter((id) => !foundIds.has(id));

	return [
		"Thread/get",
		{
			accountId: effectiveAccountId,
			state,
			list,
			notFound,
		},
		tag,
	];
}

async function handleMailboxGet(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);

	const accountIdArg = args.accountId as string | undefined;
	const effectiveAccountId = ensureAccountAccess(c, accountIdArg);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}
	const state = await getAccountState(db, effectiveAccountId, "Mailbox");

	const ids = (args.ids as string[] | undefined) ?? null;

	const condition = eq(mailboxTable.accountId, effectiveAccountId);

	const rows = await db
		.select({
			id: mailboxTable.id,
			name: mailboxTable.name,
			role: mailboxTable.role,
			sortOrder: mailboxTable.sortOrder,
		})
		.from(mailboxTable)
		.where(ids?.length ? and(condition, inArray(mailboxTable.id, ids)) : condition);

	const countRows = await db
		.select({
			mailboxId: mailboxMessageTable.mailboxId,
			total: sql<number>`count(*)`.as("total"),
		})
		.from(mailboxMessageTable)
		.groupBy(mailboxMessageTable.mailboxId);

	const countMap = new Map<string, number>();
	for (const row of countRows) {
		countMap.set(row.mailboxId, Number(row.total));
	}

	const list = rows.map((row) => ({
		id: row.id,
		name: row.name,
		role: row.role,
		sortOrder: row.sortOrder,
		totalEmails: countMap.get(row.id) ?? 0,
	}));

	const foundIds = new Set(list.map((m) => m.id));
	const notFound = ids ? ids.filter((id) => !foundIds.has(id)) : [];

	return [
		"Mailbox/get",
		{
			accountId: effectiveAccountId,
			state,
			list,
			notFound,
		},
		tag,
	];
}

async function handleMailboxQuery(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);

	const accountIdArg = args.accountId as string | undefined;
	const effectiveAccountId = ensureAccountAccess(c, accountIdArg);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}
	const queryState = await getAccountState(db, effectiveAccountId, "Mailbox");

	const rows = await db
		.select({ id: mailboxTable.id })
		.from(mailboxTable)
		.where(eq(mailboxTable.accountId, effectiveAccountId))
		.orderBy(mailboxTable.sortOrder);

	const ids = rows.map((r) => r.id);

	return [
		"Mailbox/query",
		{
			accountId: effectiveAccountId,
			queryState,
			canCalculateChanges: false,
			ids,
			position: 0,
			total: ids.length,
		},
		tag,
	];
}

type EmailSubmissionSetArgs = {
	accountId: string;
	create?: Record<string, unknown>;
	update?: Record<string, unknown>;
	destroy?: string[];
};

type EmailSubmissionSetResult = {
	accountId: string;
	oldState?: string;
	newState?: string;
	created: Record<string, unknown>;
	updated: Record<string, unknown>;
	destroyed: string[];
};

type EmailSubmissionEnvelopeOverride = {
	mailFrom?: { email: string };
	rcptTo?: { email: string }[];
};

type EmailSubmissionCreate = {
	emailId: string;
	identityId: string;
	envelope?: EmailSubmissionEnvelopeOverride;
	sendAt?: string;
};

type ResolvedEnvelope = {
	mailFrom: string;
	rcptTo: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEmailSubmissionCreate(raw: unknown): EmailSubmissionCreate {
	if (!isRecord(raw)) {
		throw new Error("EmailSubmission/create must be an object");
	}

	const emailIdValue = raw.emailId;
	if (typeof emailIdValue !== "string" || emailIdValue.length === 0) {
		throw new Error("EmailSubmission/create.emailId must be a non-empty string");
	}

	const identityIdValue = raw.identityId;
	if (typeof identityIdValue !== "string" || identityIdValue.length === 0) {
		throw new Error("EmailSubmission/create.identityId must be a non-empty string");
	}

	const result: EmailSubmissionCreate = {
		emailId: emailIdValue,
		identityId: identityIdValue,
	};

	const envelopeValue = raw.envelope;
	if (envelopeValue !== undefined) {
		if (!isRecord(envelopeValue)) {
			throw new Error("EmailSubmission/create.envelope must be an object when present");
		}

		const envelope: EmailSubmissionEnvelopeOverride = {};

		const mailFromValue = envelopeValue.mailFrom;
		if (mailFromValue !== undefined) {
			if (!isRecord(mailFromValue) || typeof mailFromValue.email !== "string") {
				throw new Error(
					"EmailSubmission/create.envelope.mailFrom.email must be a string when present"
				);
			}
			envelope.mailFrom = { email: mailFromValue.email };
		}

		const rcptToValue = envelopeValue.rcptTo;
		if (rcptToValue !== undefined) {
			if (!Array.isArray(rcptToValue)) {
				throw new Error("EmailSubmission/create.envelope.rcptTo must be an array when present");
			}
			const rcptTo: { email: string }[] = [];
			for (const item of rcptToValue) {
				if (!isRecord(item) || typeof item.email !== "string") {
					throw new Error(
						"EmailSubmission/create.envelope.rcptTo items must have an email string property"
					);
				}
				rcptTo.push({ email: item.email });
			}
			envelope.rcptTo = rcptTo;
		}

		result.envelope = envelope;
	}

	const sendAtValue = raw.sendAt;
	if (typeof sendAtValue === "string") {
		result.sendAt = sendAtValue;
	}

	return result;
}

async function resolveEnvelopeForSubmission(options: {
	db: ReturnType<typeof getDB>;
	messageId: string;
	identityEmail: string;
	override?: EmailSubmissionEnvelopeOverride;
}): Promise<ResolvedEnvelope> {
	const { db, messageId, identityEmail, override } = options;

	const mailFrom =
		override?.mailFrom?.email !== undefined && override.mailFrom.email.length > 0
			? override.mailFrom.email
			: identityEmail;

	if (override?.rcptTo !== undefined && override.rcptTo.length > 0) {
		const rcptTo = override.rcptTo.map((r) => r.email);
		return { mailFrom, rcptTo };
	}

	const rows = await db
		.select({ email: addressTable.email })
		.from(messageAddressTable)
		.innerJoin(addressTable, eq(messageAddressTable.addressId, addressTable.id))
		.where(
			and(
				eq(messageAddressTable.messageId, messageId),
				inArray(messageAddressTable.kind, ["to", "cc", "bcc"])
			)
		)
		.orderBy(messageAddressTable.kind, messageAddressTable.position);

	const seen = new Set<string>();
	const rcptTo: string[] = [];

	for (const row of rows) {
		const email = row.email;
		if (!seen.has(email)) {
			seen.add(email);
			rcptTo.push(email);
		}
	}

	if (rcptTo.length === 0) {
		throw new Error("EmailSubmission/create has no recipients; rcptTo is empty");
	}

	return { mailFrom, rcptTo };
}

type EmailSetArgs = {
	accountId: string;
	create?: Record<string, unknown>;
	update?: Record<string, unknown>;
	destroy?: string[];
};

type EmailSetResult = {
	accountId: string;
	oldState: string;
	newState: string;
	created: Record<string, unknown>;
	updated: Record<string, unknown>;
	destroyed: string[];
};

type EmailUpdatePatch = {
	mailboxIds?: Record<string, boolean>;
	keywords?: Record<string, boolean>;
};

function parseEmailUpdatePatch(raw: unknown): EmailUpdatePatch {
	if (!isRecord(raw)) {
		throw new Error("Email/set update patch must be an object");
	}

	const patch: EmailUpdatePatch = {};

	const mailboxIdsValue = raw.mailboxIds;
	if (isRecord(mailboxIdsValue)) {
		const mailboxIds: Record<string, boolean> = {};
		for (const [mailboxId, flag] of Object.entries(mailboxIdsValue)) {
			if (typeof flag === "boolean") {
				mailboxIds[mailboxId] = flag;
			}
		}
		if (Object.keys(mailboxIds).length > 0) {
			patch.mailboxIds = mailboxIds;
		}
	}

	const keywordsValue = raw.keywords;
	if (isRecord(keywordsValue)) {
		const keywords: Record<string, boolean> = {};
		for (const [keyword, flag] of Object.entries(keywordsValue)) {
			if (typeof flag === "boolean") {
				keywords[keyword] = flag;
			}
		}
		if (Object.keys(keywords).length > 0) {
			patch.keywords = keywords;
		}
	}

	return patch;
}

async function bumpStateTx(
	tx: TransactionInstance,
	accountId: string,
	type: JmapStateType
): Promise<number> {
	const [row] = await tx
		.insert(jmapStateTable)
		.values({
			accountId,
			type,
			modSeq: 1,
		})
		.onConflictDoUpdate({
			target: [jmapStateTable.accountId, jmapStateTable.type],
			set: { modSeq: sql`${jmapStateTable.modSeq} + 1` },
		})
		.returning({ modSeq: jmapStateTable.modSeq });

	return row.modSeq;
}

async function recordEmailSetChanges(opts: {
	tx: TransactionInstance;
	accountId: string;
	accountMessageId: string;
	threadId: string;
	mailboxIds: string[];
	now: Date;
}): Promise<void> {
	const { tx, accountId, accountMessageId, threadId, mailboxIds, now } = opts;

	const emailModSeq = await bumpStateTx(tx, accountId, "Email");
	await tx.insert(changeLogTable).values({
		id: crypto.randomUUID(),
		accountId,
		type: "Email",
		objectId: accountMessageId,
		modSeq: emailModSeq,
		createdAt: now,
	});

	const threadModSeq = await bumpStateTx(tx, accountId, "Thread");
	await tx.insert(changeLogTable).values({
		id: crypto.randomUUID(),
		accountId,
		type: "Thread",
		objectId: threadId,
		modSeq: threadModSeq,
		createdAt: now,
	});

	if (mailboxIds.length > 0) {
		const mailboxModSeq = await bumpStateTx(tx, accountId, "Mailbox");
		for (const mailboxId of mailboxIds) {
			await tx.insert(changeLogTable).values({
				id: crypto.randomUUID(),
				accountId,
				type: "Mailbox",
				objectId: mailboxId,
				modSeq: mailboxModSeq,
				createdAt: now,
			});
		}
	}
}

async function applyEmailSet(
	_env: JMAPHonoAppEnv["Bindings"],
	db: ReturnType<typeof getDB>,
	args: EmailSetArgs
): Promise<EmailSetResult> {
	const accountId = args.accountId;

	// For now we only support update/destroy. Create will come later with composition.
	if (args.create && Object.keys(args.create).length > 0) {
		throw new Error("Email/create is not implemented yet");
	}

	const oldState = await getAccountState(db, accountId, "Email");

	const created: Record<string, unknown> = {};
	const updated: Record<string, unknown> = {};
	const destroyed: string[] = [];

	const updateMap = args.update ?? {};
	const destroyIds = args.destroy ?? [];

	const now = new Date();

	await db.transaction(async (tx) => {
		// ───────────────────────────────────────────────────────────
		// Updates (mailboxIds, keywords -> flags)
		// ───────────────────────────────────────────────────────────
		for (const [emailId, rawPatch] of Object.entries(updateMap)) {
			const patch = parseEmailUpdatePatch(rawPatch);

			if (!patch.mailboxIds && !patch.keywords) {
				continue;
			}

			const [row] = await tx
				.select({
					id: accountMessageTable.id,
					threadId: accountMessageTable.threadId,
					isSeen: accountMessageTable.isSeen,
					isFlagged: accountMessageTable.isFlagged,
					isAnswered: accountMessageTable.isAnswered,
					isDraft: accountMessageTable.isDraft,
				})
				.from(accountMessageTable)
				.where(
					and(eq(accountMessageTable.id, emailId), eq(accountMessageTable.accountId, accountId))
				)
				.limit(1);

			if (!row) {
				// For now we silently skip unknown ids; later you can add notUpdated if you want.
				continue;
			}

			let touchedMailboxIds: string[] = [];

			if (patch.mailboxIds) {
				const targetMailboxIds = Object.entries(patch.mailboxIds)
					.filter(([, keep]) => keep)
					.map(([mailboxId]) => mailboxId);

				if (targetMailboxIds.length === 0) {
					throw new Error("Email/set: mailboxIds must not be empty when provided");
				}

				const existingRows = await tx
					.select({
						mailboxId: mailboxMessageTable.mailboxId,
					})
					.from(mailboxMessageTable)
					.where(eq(mailboxMessageTable.accountMessageId, row.id));

				const existingSet = new Set(existingRows.map((r) => r.mailboxId));
				const targetSet = new Set(targetMailboxIds);

				const toDelete = existingRows
					.filter((r) => !targetSet.has(r.mailboxId))
					.map((r) => r.mailboxId);

				const toInsert = targetMailboxIds.filter((mailboxId) => !existingSet.has(mailboxId));

				if (toDelete.length > 0) {
					await tx
						.delete(mailboxMessageTable)
						.where(
							and(
								eq(mailboxMessageTable.accountMessageId, row.id),
								inArray(mailboxMessageTable.mailboxId, toDelete)
							)
						);
				}

				for (const mailboxId of toInsert) {
					await tx.insert(mailboxMessageTable).values({
						accountMessageId: row.id,
						mailboxId,
						addedAt: now,
					});
				}

				touchedMailboxIds = Array.from(new Set([...toDelete, ...toInsert]));
			}

			let isSeen = row.isSeen;
			let isFlagged = row.isFlagged;
			let isAnswered = row.isAnswered;
			let isDraft = row.isDraft;

			if (patch.keywords) {
				const kw = patch.keywords;

				const seenValue = kw["$seen"] ?? kw["\\Seen"];
				if (seenValue !== undefined) {
					isSeen = seenValue;
				}

				const flaggedValue = kw["$flagged"] ?? kw["\\Flagged"];
				if (flaggedValue !== undefined) {
					isFlagged = flaggedValue;
				}

				const answeredValue = kw["$answered"] ?? kw["\\Answered"];
				if (answeredValue !== undefined) {
					isAnswered = answeredValue;
				}

				const draftValue = kw["$draft"] ?? kw["\\Draft"];
				if (draftValue !== undefined) {
					isDraft = draftValue;
				}

				await tx
					.update(accountMessageTable)
					.set({
						isSeen,
						isFlagged,
						isAnswered,
						isDraft,
						updatedAt: now,
					})
					.where(eq(accountMessageTable.id, row.id));
			}

			if (touchedMailboxIds.length > 0 || patch.keywords) {
				await recordEmailSetChanges({
					tx,
					accountId,
					accountMessageId: row.id,
					threadId: row.threadId,
					mailboxIds: touchedMailboxIds,
					now,
				});
			}

			// Minimal response object for this id; can be extended with more properties later.
			updated[emailId] = { id: row.id };
		}

		// ───────────────────────────────────────────────────────────
		// Destroy (soft-delete for now)
		// ───────────────────────────────────────────────────────────
		for (const emailId of destroyIds) {
			const [row] = await tx
				.select({
					id: accountMessageTable.id,
					threadId: accountMessageTable.threadId,
				})
				.from(accountMessageTable)
				.where(
					and(eq(accountMessageTable.id, emailId), eq(accountMessageTable.accountId, accountId))
				)
				.limit(1);

			if (!row) {
				continue;
			}

			await tx
				.update(accountMessageTable)
				.set({
					isDeleted: true,
					updatedAt: now,
				})
				.where(eq(accountMessageTable.id, row.id));

			// Optionally clear mailbox membership as part of delete
			await tx.delete(mailboxMessageTable).where(eq(mailboxMessageTable.accountMessageId, row.id));

			await recordEmailSetChanges({
				tx,
				accountId,
				accountMessageId: row.id,
				threadId: row.threadId,
				mailboxIds: [],
				now,
			});

			destroyed.push(emailId);
		}
	});

	const newState = await getAccountState(db, accountId, "Email");

	return {
		accountId,
		oldState,
		newState,
		created,
		updated,
		destroyed,
	};
}

async function applyEmailSubmissionSet(
	env: JMAPHonoAppEnv["Bindings"],
	db: ReturnType<typeof getDB>,
	args: EmailSubmissionSetArgs
): Promise<EmailSubmissionSetResult> {
	const accountId = args.accountId;
	const createMap = args.create ?? {};

	const created: Record<string, unknown> = {};
	const updated: Record<string, unknown> = {};
	const destroyed: string[] = [];

	const createEntries = Object.entries(createMap);

	// No-op if nothing to create for now; update/destroy can be added later.
	if (createEntries.length === 0) {
		return {
			accountId,
			created,
			updated,
			destroyed,
		};
	}

	const transport = createOutboundTransport(env);
	const now = new Date();
	const nowEpochSeconds = Math.floor(now.getTime() / 1000);

	for (const [createId, raw] of createEntries) {
		const parsed = parseEmailSubmissionCreate(raw);

		// 1) Validate identity belongs to this account
		const [identity] = await db
			.select({
				id: identityTable.id,
				email: identityTable.email,
			})
			.from(identityTable)
			.where(and(eq(identityTable.id, parsed.identityId), eq(identityTable.accountId, accountId)))
			.limit(1);

		if (!identity) {
			throw new Error("EmailSubmission/create.identityId does not belong to this account");
		}

		// 2) Resolve account message + canonical message
		const [accountMessage] = await db
			.select({
				id: accountMessageTable.id,
				messageId: accountMessageTable.messageId,
			})
			.from(accountMessageTable)
			.where(
				and(
					eq(accountMessageTable.id, parsed.emailId),
					eq(accountMessageTable.accountId, accountId)
				)
			)
			.limit(1);

		if (!accountMessage) {
			throw new Error("EmailSubmission/create.emailId not found for this account");
		}

		const [messageRow] = await db
			.select({
				id: messageTable.id,
				rawBlobSha256: messageTable.rawBlobSha256,
				size: messageTable.size,
			})
			.from(messageTable)
			.where(eq(messageTable.id, accountMessage.messageId))
			.limit(1);

		if (!messageRow) {
			throw new Error("Canonical message for EmailSubmission/create.emailId not found");
		}

		// 3) Build envelope (override -> JMAP envelope; fallback -> identity + message addresses)
		const envelope = await resolveEnvelopeForSubmission({
			db,
			messageId: messageRow.id,
			identityEmail: identity.email,
			override: parsed.envelope,
		});

		// 4) Call outbound transport
		const submissionId = crypto.randomUUID();

		const deliveryResult = await transport.send({
			accountId,
			submissionId,
			emailId: parsed.emailId,
			envelope: {
				mailFrom: envelope.mailFrom,
				rcptTo: envelope.rcptTo,
			},
			mime: {
				kind: "blob",
				sha256: messageRow.rawBlobSha256,
				size: messageRow.size,
			},
		});

		const deliveryStatus: DeliveryStatusRecord = {
			status:
				// eslint-disable-next-line no-nested-ternary
				deliveryResult.status === "accepted"
					? "accepted"
					: deliveryResult.status === "rejected"
						? "rejected"
						: "failed",
			providerMessageId: deliveryResult.providerMessageId,
			providerRequestId: deliveryResult.providerRequestId,
			reason: deliveryResult.reason,
			lastAttempt: nowEpochSeconds,
			retryCount: 0,
			permanent: deliveryResult.permanent,
		};

		// 5) Persist EmailSubmission row
		await db.insert(emailSubmissionTable).values({
			id: submissionId,
			accountId,
			emailId: parsed.emailId,
			identityId: parsed.identityId,
			envelopeJson: JSON.stringify(envelope),
			sendAt: null,
			deliveryStatusJson: deliveryStatus,
			undoStatus: null,
			createdAt: now,
			updatedAt: now,
		});

		// 6) JMAP response object for this creationId
		created[createId] = {
			id: submissionId,
			emailId: parsed.emailId,
			identityId: parsed.identityId,
		};
	}

	// We are not bumping jmapStateTable / changeLogTable yet; Email state changes will come
	// together with Email/set (moving from Drafts -> Sent, etc).
	return {
		accountId,
		created,
		updated,
		destroyed,
	};
}

async function handleEmailSet(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);
	const accountIdArg = args.accountId as string | undefined;
	const effectiveAccountId = ensureAccountAccess(c, accountIdArg);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const state = await getAccountState(db, effectiveAccountId, "Email");

	const input: EmailSetArgs = {
		accountId: effectiveAccountId,
		create: (args.create as Record<string, unknown> | undefined) ?? undefined,
		update: (args.update as Record<string, unknown> | undefined) ?? undefined,
		destroy: (args.destroy as string[] | undefined) ?? undefined,
	};

	try {
		const result = await applyEmailSet(c.env, db, input);

		return [
			"Email/set",
			{
				accountId: result.accountId,
				oldState: result.oldState ?? state,
				newState: result.newState ?? state,
				created: result.created,
				updated: result.updated,
				destroyed: result.destroyed,
			},
			tag,
		];
	} catch (err) {
		console.error("Email/set error", err);
		return ["error", { type: "serverError" }, tag];
	}
}

async function handleEmailSubmissionSet(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);

	const accountIdArg = args.accountId as string | undefined;
	const effectiveAccountId = ensureAccountAccess(c, accountIdArg);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const state = await getAccountState(db, effectiveAccountId, "Email");

	const input: EmailSubmissionSetArgs = {
		accountId: effectiveAccountId,
		create: (args.create as Record<string, unknown> | undefined) ?? undefined,
		update: (args.update as Record<string, unknown> | undefined) ?? undefined,
		destroy: (args.destroy as string[] | undefined) ?? undefined,
	};

	try {
		const result = await applyEmailSubmissionSet(c.env, db, input);

		return [
			"EmailSubmission/set",
			{
				accountId: result.accountId,
				oldState: result.oldState ?? state,
				newState: result.newState ?? state,
				created: result.created,
				updated: result.updated,
				destroyed: result.destroyed,
			},
			tag,
		];
	} catch (err) {
		console.error("EmailSubmission/set error", err);
		return ["error", { type: "serverError" }, tag];
	}
}

const methodHandlers: Record<string, JmapHandler> = {
	"Email/get": handleEmailGet,
	"Email/query": handleEmailQuery,
	"Email/changes": handleEmailChanges,
	"Thread/get": handleThreadGet,
	"Thread/changes": handleThreadChanges,
	"Mailbox/get": handleMailboxGet,
	"Mailbox/query": handleMailboxQuery,
	"Mailbox/changes": handleMailboxChanges,
	"Email/set": handleEmailSet,
	"EmailSubmission/set": handleEmailSubmissionSet,
};

async function handleJmap(c: Context<JMAPHonoAppEnv>) {
	const body = await c.req.json();
	const parsed = v.safeParse(JmapRequestSchema, body);

	if (!parsed.success) {
		return c.json({ type: "invalidArguments", errors: parsed.issues }, 400);
	}

	const req: JmapRequest = parsed.output;
	const methodResponses: JmapMethodResponse[] = [];

	for (const [name, args, tag] of req.methodCalls) {
		try {
			const handler = methodHandlers[name];
			if (!handler) {
				methodResponses.push(["error", { type: "unknownMethod", description: name }, tag]);
				continue;
			}

			const resp = await handler(c, args as Record<string, unknown>, tag);
			methodResponses.push(resp);
		} catch (err) {
			console.error("JMAP method error", name, err);
			methodResponses.push(["error", { type: "serverError" }, tag]);
		}
	}

	return c.json({ methodResponses });
}

export const jmapApp = new Hono<JMAPHonoAppEnv>();

jmapApp.use(requireJWT);
jmapApp.use(attachUserFromJwt);

jmapApp.get("/.well-known/jmap", handleSession);
jmapApp.post("/jmap", handleJmap);
