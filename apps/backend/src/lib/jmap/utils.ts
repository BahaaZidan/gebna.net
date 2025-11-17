import { and, eq, sql } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../db";
import { changeLogTable, jmapStateTable } from "../../db/schema";
import { JMAPHonoAppEnv } from "./middlewares";
import { JmapStateType } from "./types";

export function ensureAccountAccess(
	c: Context<JMAPHonoAppEnv>,
	accountIdArg: string | undefined
): string | null {
	const accountId = c.get("accountId");
	const effective = accountIdArg ?? accountId;
	if (effective !== accountId) return null;
	return accountId;
}

export async function getAccountState(
	db: ReturnType<typeof getDB>,
	accountId: string,
	type: JmapStateType
): Promise<string> {
	const [row] = await db
		.select({ modSeq: jmapStateTable.modSeq })
		.from(jmapStateTable)
		.where(and(eq(jmapStateTable.accountId, accountId), eq(jmapStateTable.type, type)))
		.limit(1);

	if (!row) return "0";
	return String(row.modSeq);
}

type ChangesResult = {
	oldState: string;
	newState: string;
	created: string[];
	updated: string[];
	destroyed: string[];
	hasMoreChanges: boolean;
};

export async function getChanges(
	db: ReturnType<typeof getDB>,
	accountId: string,
	type: JmapStateType,
	sinceState: string,
	maxChanges: number
): Promise<ChangesResult> {
	const since = Number(sinceState);
	if (!Number.isFinite(since) || since < 0) {
		throw Object.assign(new Error("invalid sinceState"), { jmapType: "cannotCalculateChanges" });
	}

	const rows = await db
		.select({
			objectId: changeLogTable.objectId,
			modSeq: changeLogTable.modSeq,
		})
		.from(changeLogTable)
		.where(
			and(
				eq(changeLogTable.accountId, accountId),
				eq(changeLogTable.type, type),
				sql`${changeLogTable.modSeq} > ${since}`
			)
		)
		.orderBy(changeLogTable.modSeq)
		.limit(maxChanges + 1);

	if (!rows.length) {
		const newState = await getAccountState(db, accountId, type);
		return {
			oldState: sinceState,
			newState,
			created: [],
			updated: [],
			destroyed: [],
			hasMoreChanges: false,
		};
	}

	const hasMoreChanges = rows.length > maxChanges;
	const slice = hasMoreChanges ? rows.slice(0, maxChanges) : rows;

	// For now, treat all as "updated" – inbound path only creates, future set-code can refine.
	const updatedIds = Array.from(new Set(slice.map((r) => r.objectId)));

	const newState = String(slice[slice.length - 1]!.modSeq);

	return {
		oldState: sinceState,
		newState,
		created: [], // TODO: distinguish when you add op column
		updated: updatedIds,
		destroyed: [], // TODO: fill when you add deletion logging
		hasMoreChanges,
	};
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
