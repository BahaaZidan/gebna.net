import { v } from "@gebna/validation";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";

import { getDB } from "./db";
import {
	accountMessageTable,
	addressTable,
	changeLogTable,
	jmapStateTable,
	mailboxMessageTable,
	mailboxTable,
	messageAddressTable,
	messageTable,
	threadTable,
} from "./db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE, JMAP_MAIL } from "./lib/jmap/constants";
import { attachUserFromJwt, requireJWT, type JMAPHonoAppEnv } from "./lib/jmap/middlewares";

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

type EmailSetArgs = {
	accountId: string;
	// TODO: type properly based on JMAP spec
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

type EmailSubmissionSetArgs = {
	accountId: string;
	// TODO: type properly
	create?: Record<string, unknown>;
	update?: Record<string, unknown>;
	destroy?: string[];
};

type EmailSubmissionSetResult = {
	accountId: string;
	oldState: string;
	newState: string;
	created: Record<string, unknown>;
	updated: Record<string, unknown>;
	destroyed: string[];
};

async function applyEmailSet(
	_env: JMAPHonoAppEnv["Bindings"],
	_db: ReturnType<typeof getDB>,
	_args: EmailSetArgs
): Promise<EmailSetResult> {
	// TODO: implement:
	// - create drafts / sent emails
	// - update flags, mailboxIds, keywords
	// - log changes into changeLogTable and bump jmapStateTable
	throw new Error("Email/set not implemented yet");
}

async function applyEmailSubmissionSet(
	_env: JMAPHonoAppEnv["Bindings"],
	_db: ReturnType<typeof getDB>,
	_args: EmailSubmissionSetArgs
): Promise<EmailSubmissionSetResult> {
	// TODO: implement:
	// - create emailSubmission rows
	// - link to Email
	// - enqueue outbound delivery
	// - update jmapStateTable + changeLogTable
	throw new Error("EmailSubmission/set not implemented yet");
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
