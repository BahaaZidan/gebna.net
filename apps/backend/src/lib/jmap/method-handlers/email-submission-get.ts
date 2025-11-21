import { and, eq, inArray } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { emailSubmissionTable } from "../../../db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
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
	const maxObjects = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	if (ids.length > maxObjects) {
		return [
			"error",
			{
				type: "limitExceeded",
				description: `ids length exceeds maxObjectsInGet (${maxObjects})`,
			},
			tag,
		];
	}
	if (ids.length === 0) {
		return ["EmailSubmission/get", { accountId: effectiveAccountId, state, list: [], notFound: [] }, tag];
	}

	const rows = await db
		.select()
		.from(emailSubmissionTable)
		.where(and(eq(emailSubmissionTable.accountId, effectiveAccountId), inArray(emailSubmissionTable.id, ids)));

	const rowMap = new Map(rows.map((row) => [row.id, row]));
	const list = ids
		.map((id) => rowMap.get(id))
		.filter((row): row is typeof rows[number] => Boolean(row))
		.map((row) => ({
			id: row.id,
			emailId: row.emailId,
			identityId: row.identityId,
			envelope: row.envelopeJson ? JSON.parse(row.envelopeJson) : null,
			sendAt: row.sendAt?.toISOString() ?? null,
			status: row.status,
			undoStatus: row.undoStatus ?? "final",
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
