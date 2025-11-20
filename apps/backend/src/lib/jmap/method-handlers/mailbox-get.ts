import { and, eq, inArray, sql } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { accountMessageTable, mailboxMessageTable, mailboxTable } from "../../../db/schema";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";

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

	const condition = eq(mailboxTable.accountId, effectiveAccountId);

	const rows = await db
		.select({
			id: mailboxTable.id,
			name: mailboxTable.name,
			parentId: mailboxTable.parentId,
			role: mailboxTable.role,
			sortOrder: mailboxTable.sortOrder,
		})
		.from(mailboxTable)
		.where(ids?.length ? and(condition, inArray(mailboxTable.id, ids)) : condition);

	const countRows = await db
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
		.where(inArray(mailboxMessageTable.mailboxId, rows.map((row) => row.id)))
		.groupBy(mailboxMessageTable.mailboxId);

	const countMap = new Map<string, { total: number; unread: number }>();
	for (const row of countRows) {
		countMap.set(row.mailboxId, {
			total: Number(row.total ?? 0),
			unread: Number(row.unread ?? 0),
		});
	}

	const ownerRights = {
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

	const list = rows.map((row) => ({
		id: row.id,
		name: row.name,
		parentId: row.parentId,
		role: row.role,
		sortOrder: row.sortOrder,
		totalEmails: countMap.get(row.id)?.total ?? 0,
		unreadEmails: countMap.get(row.id)?.unread ?? 0,
		myRights: ownerRights,
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
