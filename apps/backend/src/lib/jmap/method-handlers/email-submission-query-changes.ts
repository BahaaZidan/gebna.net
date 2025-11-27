import { Context } from "hono";

import { getDB } from "../../../db";
import { emailSubmissionTable } from "../../../db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import {
	StoredQueryStateRecord,
	decodeQueryStateValue,
	filtersEqual,
	loadQueryStateRecord,
} from "../helpers/query-state";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getChanges } from "../utils";
import {
	EmailSubmissionFilter,
	EmailSubmissionQueryProblem,
	EmailSubmissionSort,
	applyEmailSubmissionFilter,
	buildEmailSubmissionOrderBy,
	isTrivialFilter,
	normalizeEmailSubmissionFilter,
	normalizeEmailSubmissionSort,
} from "./email-submission-query";

export async function handleEmailSubmissionQueryChanges(
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
		return ["error", { type: "invalidArguments", description: "sinceQueryState is required" }, tag];
	}

	let normalizedFilter: EmailSubmissionFilter;
	let requestedSort: EmailSubmissionSort[];
	try {
		normalizedFilter = normalizeEmailSubmissionFilter(args.filter);
		requestedSort = normalizeEmailSubmissionSort(args.sort);
	} catch (err) {
		if (err instanceof EmailSubmissionQueryProblem) {
			return ["error", { type: err.type, description: err.message }, tag];
		}
		throw err;
	}

	let effectiveSort: EmailSubmissionSort[] = requestedSort;
	const parsedState = decodeQueryStateValue(sinceQueryState);
	let storedState: StoredQueryStateRecord | null = null;
	let sinceQueryStateValue = sinceQueryState;
	const filterArg = args.filter as Record<string, unknown> | null | undefined;

	if (parsedState) {
		storedState = await loadQueryStateRecord(db, effectiveAccountId, parsedState.id);
		if (!storedState) {
			return [
				"error",
				{ type: "invalidArguments", description: "Unknown or expired queryState" },
				tag,
			];
		}
		sinceQueryStateValue = parsedState.modSeq;
		const storedFilter = (storedState.filter as EmailSubmissionFilter | null) ?? {};
		if (filterArg === undefined) {
			normalizedFilter = storedFilter;
		} else if (!filtersEqual(normalizedFilter, storedFilter)) {
			return [
				"error",
				{
					type: "invalidArguments",
					description: "Filter does not match stored queryState",
				},
				tag,
			];
		}
		const storedSort = Array.isArray(storedState.sort)
			? (storedState.sort as EmailSubmissionSort[])
			: requestedSort;
		effectiveSort = storedSort;
	} else if (filterArg && typeof filterArg === "object" && Object.keys(filterArg).length > 0) {
		return [
			"error",
			{
				type: "unsupportedFilter",
				description: "Filter requires a more recent queryState value",
			},
			tag,
		];
	}

	const maxChangesArg = args.maxChanges as number | undefined;
	const limitFromConstraints = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	const maxChanges =
		typeof maxChangesArg === "number" && Number.isFinite(maxChangesArg) && maxChangesArg > 0
			? Math.min(maxChangesArg, limitFromConstraints)
			: limitFromConstraints;

	try {
		const changeSet = await getChanges(
			db,
			effectiveAccountId,
			"EmailSubmission",
			sinceQueryStateValue,
			maxChanges
		);

		const orderedRows = await db
			.select({ id: emailSubmissionTable.id })
			.from(emailSubmissionTable)
			.where(applyEmailSubmissionFilter(effectiveAccountId, normalizedFilter))
			.orderBy(...buildEmailSubmissionOrderBy(effectiveSort));

		const indexMap = new Map<string, number>();
		for (let i = 0; i < orderedRows.length; i++) {
			indexMap.set(orderedRows[i]!.id, i);
		}

		const added = [...changeSet.created, ...changeSet.updated]
			.map((id) => {
				const index = indexMap.get(id);
				if (index === undefined) {
					return null;
				}
				return { id, index };
			})
			.filter((entry): entry is { id: string; index: number } => entry !== null);

		const removedSet = new Set<string>(changeSet.destroyed);
		for (const id of changeSet.updated) {
			if (!indexMap.has(id)) {
				removedSet.add(id);
			}
		}
		const removed = Array.from(removedSet);
		const totalChanged = added.length + removed.length;

		return [
			"EmailSubmission/queryChanges",
			{
				accountId: effectiveAccountId,
				oldQueryState: changeSet.oldState,
				newQueryState: changeSet.newState,
				totalChanged,
				added,
				removed,
				filter: isTrivialFilter(normalizedFilter) ? null : normalizedFilter,
				sort: effectiveSort,
				limit: maxChanges,
				hasMoreChanges: changeSet.hasMoreChanges,
			},
			tag,
		];
	} catch (err) {
		console.error("EmailSubmission/queryChanges error", err);
		if (err instanceof Error && (err as { jmapType?: string }).jmapType === "cannotCalculateChanges") {
			return ["error", { type: "cannotCalculateChanges", description: err.message }, tag];
		}
		return ["error", { type: "serverError" }, tag];
	}
}
