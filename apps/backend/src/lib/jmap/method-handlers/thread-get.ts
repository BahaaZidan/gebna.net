import { and, desc, eq, inArray } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { accountMessageTable, threadTable } from "../../../db/schema";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";

export async function handleThreadGet(
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
			internalDate: accountMessageTable.internalDate,
		})
		.from(threadTable)
		.innerJoin(accountMessageTable, eq(threadTable.id, accountMessageTable.threadId))
		.where(
			and(
				eq(threadTable.accountId, effectiveAccountId),
				inArray(threadTable.id, ids),
				eq(accountMessageTable.isDeleted, false)
			)
		)
		.orderBy(threadTable.id, desc(accountMessageTable.internalDate));

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
