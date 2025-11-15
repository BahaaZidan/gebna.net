import { v } from "@gebna/validation";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";

import { getDB } from "./db";
import {
	accountMessageTable,
	addressTable,
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

async function handleSession(c: Context<JMAPHonoAppEnv>) {
	const user = c.get("user");
	const userId = user.id;
	const accountId = c.get("accountId");

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
		state: "0",
	};

	return c.json(session);
}

async function handleEmailGet(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);
	const accountId = c.get("accountId");

	const accountIdArg = (args.accountId as string | undefined) ?? accountId;
	if (accountIdArg !== accountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const ids = (args.ids as string[] | undefined) ?? [];
	if (!ids.length) {
		return ["Email/get", { accountId, state: "0", list: [], notFound: [] }, tag];
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
		.where(and(eq(accountMessageTable.accountId, accountId), inArray(accountMessageTable.id, ids)));

	if (!rows.length) {
		return ["Email/get", { accountId, state: "0", list: [], notFound: ids }, tag];
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
			accountId,
			state: "0",
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
	const accountId = c.get("accountId");

	const accountIdArg = (args.accountId as string | undefined) ?? accountId;
	if (accountIdArg !== accountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const limit = typeof args.limit === "number" ? args.limit : 50;

	const rows = await db
		.select({
			emailId: accountMessageTable.id,
		})
		.from(accountMessageTable)
		.where(eq(accountMessageTable.accountId, accountId))
		.orderBy(desc(accountMessageTable.internalDate))
		.limit(limit);

	const ids = rows.map((r) => r.emailId);

	return [
		"Email/query",
		{
			accountId,
			queryState: "0",
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
	const accountId = c.get("accountId");

	const accountIdArg = (args.accountId as string | undefined) ?? accountId;
	if (accountIdArg !== accountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const ids = (args.ids as string[] | undefined) ?? [];
	if (!ids.length) {
		return ["Thread/get", { accountId, state: "0", list: [], notFound: [] }, tag];
	}

	const rows = await db
		.select({
			threadId: threadTable.id,
			emailId: accountMessageTable.id,
		})
		.from(threadTable)
		.innerJoin(accountMessageTable, eq(threadTable.id, accountMessageTable.threadId))
		.where(and(eq(threadTable.accountId, accountId), inArray(threadTable.id, ids)));

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
			accountId,
			state: "0",
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
	const accountId = c.get("accountId");

	const accountIdArg = (args.accountId as string | undefined) ?? accountId;
	if (accountIdArg !== accountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const ids = (args.ids as string[] | undefined) ?? null;

	const condition = eq(mailboxTable.accountId, accountId);

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
			accountId,
			state: "0",
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
	const accountId = c.get("accountId");

	const accountIdArg = (args.accountId as string | undefined) ?? accountId;
	if (accountIdArg !== accountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const rows = await db
		.select({ id: mailboxTable.id })
		.from(mailboxTable)
		.where(eq(mailboxTable.accountId, accountId))
		.orderBy(mailboxTable.sortOrder);

	const ids = rows.map((r) => r.id);

	return [
		"Mailbox/query",
		{
			accountId,
			queryState: "0",
			canCalculateChanges: false,
			ids,
			position: 0,
			total: ids.length,
		},
		tag,
	];
}

const methodHandlers: Record<string, JmapHandler> = {
	"Email/get": handleEmailGet,
	"Email/query": handleEmailQuery,
	"Thread/get": handleThreadGet,
	"Mailbox/get": handleMailboxGet,
	"Mailbox/query": handleMailboxQuery,
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
