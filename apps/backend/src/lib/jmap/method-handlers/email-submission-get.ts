import { eq } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { emailSubmissionTable } from "../../../db/schema";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";

export async function handleEmailSubmissionGet(
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

	const state = await getAccountState(db, effectiveAccountId, "EmailSubmission");
	const ids = (args.ids as string[] | undefined) ?? [];
	if (ids.length === 0) {
		return ["EmailSubmission/get", { accountId: effectiveAccountId, state, list: [], notFound: [] }, tag];
	}

	const rows = await db
		.select()
		.from(emailSubmissionTable)
		.where(eq(emailSubmissionTable.accountId, effectiveAccountId));

	const list = rows
		.filter((row) => ids.includes(row.id))
		.map((row) => ({
			id: row.id,
			emailId: row.emailId,
			identityId: row.identityId,
			envelope: row.envelopeJson ? JSON.parse(row.envelopeJson) : null,
			sendAt: row.sendAt?.toISOString() ?? null,
			status: row.status,
			deliveryStatus: row.deliveryStatusJson ?? null,
		}));

	const foundIds = new Set(list.map((item) => item.id));
	const notFound = ids.filter((id) => !foundIds.has(id));

	return [
		"EmailSubmission/get",
		{
			accountId: effectiveAccountId,
			state,
			list,
			notFound,
		},
		tag,
	];
}
