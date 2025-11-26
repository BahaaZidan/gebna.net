import { and, desc, eq, inArray } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { accountMessageTable, threadTable } from "../../../db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState, parseRequestedProperties } from "../utils";

type ThreadRecord = {
	id: string;
	emailIds?: string[];
};

export async function handleThreadGet(
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
	const state = await getAccountState(db, effectiveAccountId, "Thread");

	const idsArg = args.ids as string[] | null | undefined;
	const shouldStreamDefaultList = idsArg === null || idsArg === undefined;
	if (!shouldStreamDefaultList && !Array.isArray(idsArg)) {
		return ["error", { type: "invalidArguments", description: "ids must be an array or null" }, tag];
	}
	const providedIds = Array.isArray(idsArg) ? idsArg : null;
	const maxObjects = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	if (providedIds && providedIds.length > maxObjects) {
		return [
			"error",
			{
				type: "limitExceeded",
				description: `ids length exceeds maxObjectsInGet (${maxObjects})`,
			},
			tag,
		];
	}

	let idsToFetch: string[] = [];
	if (shouldStreamDefaultList) {
		const defaultRows = await db
			.select({ id: threadTable.id })
			.from(threadTable)
			.where(eq(threadTable.accountId, effectiveAccountId))
			.orderBy(desc(threadTable.latestMessageAt), desc(threadTable.id))
			.limit(maxObjects);
		idsToFetch = defaultRows.map((row) => row.id);
	} else if (providedIds) {
		if (providedIds.length === 0) {
			return ["Thread/get", { accountId: effectiveAccountId, state, list: [], notFound: [] }, tag];
		}
		idsToFetch = providedIds;
	}

	if (!idsToFetch.length) {
		return ["Thread/get", { accountId: effectiveAccountId, state, list: [], notFound: [] }, tag];
	}

	const THREAD_PROPERTIES = ["id", "emailIds"] as const;
	const propertiesResult = parseRequestedProperties(args.properties, THREAD_PROPERTIES);
	if ("error" in propertiesResult) {
		return ["error", { type: "invalidArguments", description: propertiesResult.error }, tag];
	}
	const requestedProperties = propertiesResult.properties;
	const includeEmailIds = !requestedProperties || requestedProperties.has("emailIds");

	const rows = await db
		.select({
			threadId: threadTable.id,
			emailId: accountMessageTable.id,
			internalDate: accountMessageTable.internalDate,
		})
		.from(threadTable)
		.innerJoin(accountMessageTable, eq(threadTable.id, accountMessageTable.threadId))
		.where(
			and(
				eq(threadTable.accountId, effectiveAccountId),
				inArray(threadTable.id, idsToFetch),
				eq(accountMessageTable.isDeleted, false)
			)
		)
		.orderBy(threadTable.id, desc(accountMessageTable.internalDate));

	const byThread = new Map<string, string[]>();
	for (const row of rows) {
		const arr = byThread.get(row.threadId) ?? [];
		arr.push(row.emailId);
		byThread.set(row.threadId, arr);
	}

	const list: ThreadRecord[] = Array.from(byThread.entries()).map(([threadId, emailIds]) => {
		const entry: ThreadRecord = { id: threadId };
		if (includeEmailIds) {
			entry.emailIds = emailIds;
		}
		return entry;
	});

	const foundIds = new Set(list.map((t) => t.id));
	const notFound = providedIds ? providedIds.filter((id) => !foundIds.has(id)) : [];

	return [
		"Thread/get",
		{
			accountId: effectiveAccountId,
			state,
			list,
			notFound,
		},
		tag,
	];
}
