import { Context } from "hono";

import { getDB } from "../../../db";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getChanges } from "../utils";

export async function handleEmailSubmissionChanges(
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

	const sinceState = (args.sinceState as string | undefined) ?? "0";
	const maxChanges = typeof args.maxChanges === "number" ? args.maxChanges : 50;

	try {
		const changeSet = await getChanges(db, effectiveAccountId, "EmailSubmission", sinceState, maxChanges);
		return [
			"EmailSubmission/changes",
			{
				accountId: effectiveAccountId,
				oldState: changeSet.oldState,
				newState: changeSet.newState,
				hasMoreChanges: changeSet.hasMoreChanges,
				created: changeSet.created,
				updated: changeSet.updated,
				destroyed: changeSet.destroyed,
			},
			tag,
		];
	} catch (err) {
		console.error("EmailSubmission/changes error", err);
		return ["error", { type: "serverError" }, tag];
	}
}
