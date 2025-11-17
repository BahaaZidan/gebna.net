import { desc, eq } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { accountMessageTable } from "../../../db/schema";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";

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
