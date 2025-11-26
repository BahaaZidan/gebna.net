import { Context } from "hono";

import { getDB } from "../../../db";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
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

	const sinceStateArg = args.sinceState;
	if (typeof sinceStateArg !== "string" || sinceStateArg.length === 0) {
		return ["error", { type: "invalidArguments", description: "sinceState is required" }, tag];
	}
	const sinceState = sinceStateArg;
	const limitFromConstraints = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	const maxChangesInput = typeof args.maxChanges === "number" && Number.isFinite(args.maxChanges) ? args.maxChanges : 50;
	const maxChanges = Math.min(maxChangesInput, limitFromConstraints);
	const upToId = typeof args.upToId === "string" ? args.upToId : undefined;
	const includeUpdatedProps = Boolean(args.includeUpdatedProperties);

	try {
		const changeSet = await getChanges(db, effectiveAccountId, "EmailSubmission", sinceState, maxChanges, {
			upToId,
			includeUpdatedProperties: includeUpdatedProps,
		});
		return [
			"EmailSubmission/changes",
			{
				accountId: effectiveAccountId,
				oldState: changeSet.oldState,
				newState: changeSet.newState,
				hasMoreChanges: changeSet.hasMoreChanges,
				created: changeSet.created,
				updated: changeSet.updated,
				updatedProperties: includeUpdatedProps ? changeSet.updatedProperties : null,
				destroyed: changeSet.destroyed,
				upToId: upToId ?? null,
			},
			tag,
		];
	} catch (err) {
		if ((err as { jmapType?: string }).jmapType === "cannotCalculateChanges") {
			return [
				"error",
				{ type: "cannotCalculateChanges", description: (err as Error).message },
				tag,
			];
		}
		console.error("EmailSubmission/changes error", err);
		return ["error", { type: "serverError" }, tag];
	}
}
