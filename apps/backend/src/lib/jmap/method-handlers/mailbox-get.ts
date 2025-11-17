import { and, eq, inArray, sql } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { mailboxMessageTable, mailboxTable } from "../../../db/schema";
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
