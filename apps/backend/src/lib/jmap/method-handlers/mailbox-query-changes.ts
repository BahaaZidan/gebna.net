import { Context } from "hono";

import { getDB } from "../../../db";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getChanges } from "../utils";
import { normalizeMailboxFilter, normalizeMailboxSort } from "./mailbox-query";

export async function handleMailboxQueryChanges(
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

	const sinceQueryState = args.sinceQueryState as string | undefined;
	if (!sinceQueryState) {
		return [
			"error",
			{ type: "invalidArguments", description: "sinceQueryState is required" },
			tag,
		];
	}

	const filter = normalizeMailboxFilter(args.filter);
	if (filter.operator !== "all") {
		return [
			"error",
			{
				type: "cannotCalculateChanges",
				description: "Mailbox/queryChanges is only supported for the full mailbox list.",
			},
			tag,
		];
	}

	const sort = normalizeMailboxSort(args.sort);
	const maxChangesArg = args.maxChanges as number | undefined;
	const limitFromConstraints = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	const maxChanges =
		typeof maxChangesArg === "number" && Number.isFinite(maxChangesArg) && maxChangesArg > 0
			? Math.min(maxChangesArg, limitFromConstraints)
			: limitFromConstraints;

	try {
		const changeSet = await getChanges(db, effectiveAccountId, "Mailbox", sinceQueryState, maxChanges);
		const added = [...changeSet.created, ...changeSet.updated].map((id) => ({ id, index: 0 }));
		const removed = [...changeSet.destroyed];
		const totalChanged = added.length + removed.length;

		return [
			"Mailbox/queryChanges",
			{
				accountId: effectiveAccountId,
				oldQueryState: changeSet.oldState,
				newQueryState: changeSet.newState,
				totalChanged,
				added,
				removed,
				filter: null,
				sort,
				limit: maxChanges,
				hasMoreChanges: changeSet.hasMoreChanges,
			},
			tag,
		];
	} catch (err) {
		console.error("Mailbox/queryChanges error", err);
		if (err instanceof Error && (err as { jmapType?: string }).jmapType === "cannotCalculateChanges") {
			return ["error", { type: "cannotCalculateChanges", description: err.message }, tag];
		}
		return ["error", { type: "serverError" }, tag];
	}
}
