import { Context } from "hono";

import { getDB } from "../../../db";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getChanges } from "../utils";

export async function handleIdentityChanges(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);
	const effectiveAccountId = ensureAccountAccess(c, args.accountId as string | undefined);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const sinceState = (args.sinceState as string | undefined) ?? "0";
	const maxChangesArg = args.maxChanges as number | undefined;
	const upToId = typeof args.upToId === "string" ? args.upToId : undefined;
	const includeUpdatedProps = Boolean(args.includeUpdatedProperties);
	const limitFromConstraints = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	const maxChanges =
		typeof maxChangesArg === "number" && Number.isFinite(maxChangesArg) && maxChangesArg > 0
			? Math.min(maxChangesArg, limitFromConstraints)
			: limitFromConstraints;

	try {
		const changes = await getChanges(db, effectiveAccountId, "Identity", sinceState, maxChanges, {
			upToId,
			includeUpdatedProperties: includeUpdatedProps,
		});

		return [
			"Identity/changes",
			{
				accountId: effectiveAccountId,
				oldState: changes.oldState,
				newState: changes.newState,
				hasMoreChanges: changes.hasMoreChanges,
				created: changes.created,
				updated: changes.updated,
				updatedProperties: includeUpdatedProps ? changes.updatedProperties : null,
				destroyed: changes.destroyed,
				upToId: upToId ?? null,
			},
			tag,
		];
	} catch (err) {
		console.error("Identity/changes error", err);
		if (err instanceof Error && (err as { jmapType?: string }).jmapType === "cannotCalculateChanges") {
			return ["error", { type: "cannotCalculateChanges", description: err.message }, tag];
		}
		return ["error", { type: "serverError" }, tag];
	}
}
