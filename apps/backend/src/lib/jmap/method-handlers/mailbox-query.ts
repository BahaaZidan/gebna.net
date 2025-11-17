import { eq } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { mailboxTable } from "../../../db/schema";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";

export async function handleMailboxQuery(
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
