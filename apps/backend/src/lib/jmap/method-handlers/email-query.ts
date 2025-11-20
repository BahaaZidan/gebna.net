import { and, desc, eq, like, or } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { accountMessageTable, messageTable } from "../../../db/schema";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";

function escapeLikePattern(input: string): string {
	return input.replace(/[\\_%]/g, (ch) => `\\${ch}`);
}

export async function handleEmailQuery(
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

	const filterArg = args.filter;
	const textFilter =
		filterArg && typeof filterArg === "object" && filterArg !== null
			? (() => {
				const value = (filterArg as { text?: unknown }).text;
				return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
			})()
			: null;

	const baseCondition = eq(accountMessageTable.accountId, effectiveAccountId);
	const whereExpr = textFilter
		? (() => {
			const pattern = `%${escapeLikePattern(textFilter)}%`;
			return and(
				baseCondition,
				or(like(messageTable.subject, pattern), like(messageTable.snippet, pattern))
			);
		})()
		: baseCondition;

	const rows = await db
		.select({
			emailId: accountMessageTable.id,
		})
		.from(accountMessageTable)
		.innerJoin(messageTable, eq(accountMessageTable.messageId, messageTable.id))
		.where(whereExpr)
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
