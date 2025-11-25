import { and, eq, inArray, sql } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { accountMessageTable, mailboxMessageTable, mailboxTable } from "../../../db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState, parseRequestedProperties } from "../utils";

type MailboxRecord = {
	id: string;
	name?: string;
	parentId?: string | null;
	role?: string | null;
	sortOrder?: number;
	totalEmails?: number;
	unreadEmails?: number;
	totalThreads?: number;
	unreadThreads?: number;
	isSubscribed?: boolean;
	hasChildren?: boolean;
	myRights?: MailboxRights;
};

const MAILBOX_PROPERTIES = [
	"id",
	"name",
	"parentId",
	"role",
	"sortOrder",
	"totalEmails",
	"unreadEmails",
	"totalThreads",
	"unreadThreads",
	"isSubscribed",
	"hasChildren",
	"myRights",
] as const;

export async function handleMailboxGet(
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
	const maxObjects = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	if (Array.isArray(ids) && ids.length > maxObjects) {
		return [
			"error",
			{
				type: "limitExceeded",
				description: `ids length exceeds maxObjectsInGet (${maxObjects})`,
			},
			tag,
		];
	}

	const condition = eq(mailboxTable.accountId, effectiveAccountId);

	const propertiesResult = parseRequestedProperties(args.properties, MAILBOX_PROPERTIES);
	if ("error" in propertiesResult) {
		return ["error", { type: "invalidArguments", description: propertiesResult.error }, tag];
	}
	const requestedProperties = propertiesResult.properties;
	const includeProp = (prop: (typeof MAILBOX_PROPERTIES)[number]) =>
		!requestedProperties || requestedProperties.has(prop);

	const rows = await (ids?.length
		? db
				.select({
					id: mailboxTable.id,
					name: mailboxTable.name,
					parentId: mailboxTable.parentId,
					role: mailboxTable.role,
					sortOrder: mailboxTable.sortOrder,
				})
				.from(mailboxTable)
				.where(and(condition, inArray(mailboxTable.id, ids)))
		: db
				.select({
					id: mailboxTable.id,
					name: mailboxTable.name,
					parentId: mailboxTable.parentId,
					role: mailboxTable.role,
					sortOrder: mailboxTable.sortOrder,
				})
				.from(mailboxTable)
				.where(condition)
				.limit(maxObjects));

	const mailboxIds = rows.map((row) => row.id);
	const countRows = mailboxIds.length
		? await db
				.select({
					mailboxId: mailboxMessageTable.mailboxId,
					total: sql<number>`count(*)`.as("total"),
					unread: sql<number>`sum(case when ${accountMessageTable.isSeen} = 0 then 1 else 0 end)`.as(
						"unread"
					),
				})
				.from(mailboxMessageTable)
				.innerJoin(
					accountMessageTable,
					eq(mailboxMessageTable.accountMessageId, accountMessageTable.id)
				)
				.where(
					and(
						inArray(mailboxMessageTable.mailboxId, mailboxIds),
						eq(accountMessageTable.isDeleted, false)
					)
				)
				.groupBy(mailboxMessageTable.mailboxId)
		: [];

	const countMap = new Map<string, { total: number; unread: number }>();
	for (const row of countRows) {
		countMap.set(row.mailboxId, {
			total: Number(row.total ?? 0),
			unread: Number(row.unread ?? 0),
		});
	}

	const threadCountRows = mailboxIds.length
		? await db
				.select({
					mailboxId: mailboxMessageTable.mailboxId,
					totalThreads: sql<number>`count(distinct ${accountMessageTable.threadId})`.as("totalThreads"),
					unreadThreads: sql<number>`count(distinct case when ${accountMessageTable.isSeen} = 0 then ${accountMessageTable.threadId} end)`.as(
						"unreadThreads"
					),
				})
				.from(mailboxMessageTable)
				.innerJoin(accountMessageTable, eq(mailboxMessageTable.accountMessageId, accountMessageTable.id))
				.where(
					and(
						inArray(mailboxMessageTable.mailboxId, mailboxIds),
						eq(accountMessageTable.isDeleted, false)
					)
				)
				.groupBy(mailboxMessageTable.mailboxId)
		: [];
	const threadCountMap = new Map<string, { totalThreads: number; unreadThreads: number }>();
	for (const row of threadCountRows) {
		threadCountMap.set(row.mailboxId, {
			totalThreads: Number(row.totalThreads ?? 0),
			unreadThreads: Number(row.unreadThreads ?? 0),
		});
	}

const childRows = await db
	.select({ parentId: mailboxTable.parentId })
	.from(mailboxTable)
	.where(and(eq(mailboxTable.accountId, effectiveAccountId), sql`${mailboxTable.parentId} is not null`));
const hasChildSet = new Set(
	childRows
		.map((row) => row.parentId)
		.filter((value): value is string => typeof value === "string" && value.length > 0)
);

	const list: MailboxRecord[] = rows.map((row) => {
		const entry: MailboxRecord = { id: row.id };
		const role = row.role ?? null;
		if (includeProp("name")) entry.name = row.name;
		if (includeProp("parentId")) entry.parentId = row.parentId;
		if (includeProp("role")) entry.role = role;
		if (includeProp("sortOrder")) entry.sortOrder = row.sortOrder;
		if (includeProp("totalEmails")) entry.totalEmails = countMap.get(row.id)?.total ?? 0;
		if (includeProp("unreadEmails")) entry.unreadEmails = countMap.get(row.id)?.unread ?? 0;
		if (includeProp("totalThreads")) entry.totalThreads = threadCountMap.get(row.id)?.totalThreads ?? 0;
		if (includeProp("unreadThreads"))
			entry.unreadThreads = threadCountMap.get(row.id)?.unreadThreads ?? 0;
		if (includeProp("isSubscribed")) entry.isSubscribed = true;
		if (includeProp("hasChildren")) entry.hasChildren = hasChildSet.has(row.id);
		if (includeProp("myRights")) {
			entry.myRights = getRightsForRole(role);
		}
		return entry;
	});

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

type MailboxRights = {
	mayReadItems: boolean;
	mayAddItems: boolean;
	mayRemoveItems: boolean;
	mayCreateChild: boolean;
	mayRename: boolean;
	mayDelete: boolean;
	maySetSeen: boolean;
	maySetKeywords: boolean;
	maySubmit: boolean;
};

const BASE_RIGHTS: MailboxRights = {
	mayReadItems: true,
	mayAddItems: true,
	mayRemoveItems: true,
	mayCreateChild: true,
	mayRename: true,
	mayDelete: true,
	maySetSeen: true,
	maySetKeywords: true,
	maySubmit: true,
};

const ROLE_RIGHTS: Record<string, Partial<MailboxRights>> = {
	inbox: { mayCreateChild: false, mayRename: false, mayDelete: false },
	sent: { mayRename: false, mayDelete: false },
	drafts: { mayRename: false, mayDelete: false },
	trash: { mayCreateChild: false, mayRename: false, mayDelete: false },
	spam: { mayCreateChild: false, mayRename: false, mayDelete: false },
};

function createRights(overrides: Partial<MailboxRights> = {}): MailboxRights {
	return { ...BASE_RIGHTS, ...overrides };
}

function getRightsForRole(role: string | null): MailboxRights {
	const overrides = role ? ROLE_RIGHTS[role] ?? {} : {};
	return createRights(overrides);
}
