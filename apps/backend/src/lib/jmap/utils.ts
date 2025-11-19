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
		throw Object.assign(new Error("invalid sinceState"), {
			jmapType: "cannotCalculateChanges",
		});
	}

	const rows = await db
		.select({
			objectId: changeLogTable.objectId,
			modSeq: changeLogTable.modSeq,
			op: changeLogTable.op,
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

	const perId = new Map<
		string,
		{ firstOp: (typeof rows)[number]["op"]; lastOp: (typeof rows)[number]["op"] }
	>();

	for (const row of slice) {
		const existing = perId.get(row.objectId);
		if (!existing) {
			perId.set(row.objectId, { firstOp: row.op, lastOp: row.op });
		} else {
			perId.set(row.objectId, { firstOp: existing.firstOp, lastOp: row.op });
		}
	}

	const created: string[] = [];
	const updated: string[] = [];
	const destroyed: string[] = [];

	for (const [id, ops] of perId) {
		const { firstOp, lastOp } = ops;

		if (lastOp === "destroy") {
			destroyed.push(id);
		} else if (firstOp === "create") {
			created.push(id);
		} else {
			updated.push(id);
		}
	}

	const newState = String(slice[slice.length - 1]!.modSeq);

	return {
		oldState: sinceState,
		newState,
		created,
		updated,
		destroyed,
		hasMoreChanges,
	};
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
