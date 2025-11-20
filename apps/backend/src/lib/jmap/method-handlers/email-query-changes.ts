import { Context } from "hono";

import { getDB } from "../../../db";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getChanges } from "../utils";

export async function handleEmailQueryChanges(
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

	const filter = args.filter;
	if (filter && Object.keys(filter as Record<string, unknown>).length > 0) {
		return [
			"error",
			{
				type: "unsupportedFilter",
				description: "Email/queryChanges currently supports only the default (empty) filter.",
			},
			tag,
		];
	}

	const sinceQueryState = args.sinceQueryState as string | undefined;
	if (!sinceQueryState) {
		return [
			"error",
			{
				type: "invalidArguments",
				description: "sinceQueryState is required",
			},
			tag,
		];
	}

	const maxChangesArg = args.maxChanges as number | undefined;
	const maxObjectsLimit = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	const maxChanges =
		maxChangesArg && Number.isFinite(maxChangesArg) && maxChangesArg > 0
			? Math.min(maxChangesArg, maxObjectsLimit)
			: maxObjectsLimit;

	try {
		const changeSet = await getChanges(
			db,
			effectiveAccountId,
			"Email",
			sinceQueryState,
			maxChanges
		);
		const added = changeSet.created.map((id) => ({
			id,
			index: 0,
		}));
		const removed = changeSet.destroyed;
		const totalChanged = added.length + removed.length;

		return [
			"Email/queryChanges",
			{
				accountId: effectiveAccountId,
				oldQueryState: changeSet.oldState,
				newQueryState: changeSet.newState,
				totalChanged,
				added,
				removed,
				filter: null,
				sort: [{ property: "receivedAt", isAscending: false }],
				limit: maxChanges,
				hasMoreChanges: changeSet.hasMoreChanges,
				collapseThreads: false,
			},
			tag,
		];
	} catch (err) {
		console.error("Email/queryChanges error", err);
		if (err instanceof Error && (err as { jmapType?: string }).jmapType === "cannotCalculateChanges") {
			return ["error", { type: "cannotCalculateChanges", description: err.message }, tag];
		}
		return ["error", { type: "serverError" }, tag];
	}
}
