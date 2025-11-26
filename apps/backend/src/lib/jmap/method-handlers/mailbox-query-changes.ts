import { eq } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { mailboxTable } from "../../../db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getChanges } from "../utils";
import {
	normalizeMailboxFilter,
	normalizeMailboxSort,
	buildOrderBy,
	MailboxSort,
	MailboxFilter,
	applyFilter,
} from "./mailbox-query";
import {
	StoredQueryStateRecord,
	decodeQueryStateValue,
	filtersEqual,
	loadQueryStateRecord,
} from "../helpers/query-state";

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

	const filterArg = args.filter as Record<string, unknown> | null | undefined;
	let normalizedFilter = normalizeMailboxFilter(filterArg);
	const requestedSort = normalizeMailboxSort(args.sort);
	let effectiveSort: MailboxSort[] = requestedSort;
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
		const storedFilter = (storedState.filter as MailboxFilter | null) ?? { operator: "all" };
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
			? (storedState.sort as MailboxSort[])
			: requestedSort;
		effectiveSort = storedSort;
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

	const maxChangesArg = args.maxChanges as number | undefined;
	const limitFromConstraints = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	const maxChanges =
		typeof maxChangesArg === "number" && Number.isFinite(maxChangesArg) && maxChangesArg > 0
			? Math.min(maxChangesArg, limitFromConstraints)
			: limitFromConstraints;

	try {
		const changeSet = await getChanges(db, effectiveAccountId, "Mailbox", sinceQueryStateValue, maxChanges);

		const orderedRows = await db
			.select({ id: mailboxTable.id })
			.from(mailboxTable)
			.where(applyFilter(effectiveAccountId, normalizedFilter))
			.orderBy(...buildOrderBy(effectiveSort));
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
			"Mailbox/queryChanges",
			{
				accountId: effectiveAccountId,
				oldQueryState: changeSet.oldState,
				newQueryState: changeSet.newState,
				totalChanged,
				added,
				removed,
				filter: normalizedFilter.operator === "all" ? null : normalizedFilter,
				sort: effectiveSort,
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
