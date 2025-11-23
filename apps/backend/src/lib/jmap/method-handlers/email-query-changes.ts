import { Context } from "hono";

import { getDB } from "../../../db";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getChanges } from "../utils";
import {
	filterIdsMatchingQuery,
	normalizeFilter,
} from "./email-query";
import {
	StoredQueryStateRecord,
	decodeQueryStateValue,
	filtersEqual,
	loadQueryStateRecord,
} from "../helpers/query-state";

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

	let filterArg = args.filter as Record<string, unknown> | null | undefined;

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

	const parsedState = decodeQueryStateValue(sinceQueryState);
	let storedState: StoredQueryStateRecord | null = null;
	let sinceQueryStateValue = sinceQueryState;

	if (parsedState) {
		storedState = await loadQueryStateRecord(db, effectiveAccountId, parsedState.id);
		if (!storedState) {
			return [
				"error",
				{
					type: "invalidArguments",
					description: "Unknown or expired queryState",
				},
				tag,
			];
		}
		sinceQueryStateValue = parsedState.modSeq;
		if (filterArg === undefined) {
			filterArg = storedState.filter as Record<string, unknown> | null;
		} else if (!filtersEqual(filterArg, storedState.filter)) {
			return [
				"error",
				{
					type: "invalidArguments",
					description: "Filter does not match stored queryState",
				},
				tag,
			];
		}
	} else if (filterArg && typeof filterArg === "object" && Object.keys(filterArg).length > 0) {
		return [
			"error",
			{
				type: "unsupportedFilter",
				description: "Filter requires a queryState generated after filtering support was added.",
			},
			tag,
		];
	}

	const normalizedFilter = normalizeFilter(filterArg ?? null);
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
			sinceQueryStateValue,
			maxChanges
		);
		const matchingAdded = await filterIdsMatchingQuery(
			db,
			effectiveAccountId,
			normalizedFilter,
			changeSet.created
		);
		const matchingUpdated = await filterIdsMatchingQuery(
			db,
			effectiveAccountId,
			normalizedFilter,
			changeSet.updated
		);
		const added = [...matchingAdded, ...matchingUpdated].map((id) => ({ id, index: 0 }));
		const removedFromUpdated = changeSet.updated.filter((id) => !matchingUpdated.has(id));
		const removed = [...changeSet.destroyed, ...removedFromUpdated];
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
				filter: filterArg ?? null,
				sort: storedState?.sort ?? [{ property: "receivedAt", isAscending: false }],
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
