import { eq } from "drizzle-orm";

import { type DBInstance, type TransactionInstance } from "../../db";
import {
	changeLogTable,
	jmapStateTable,
	type ChangeLogOp,
	type ChangeLogType,
} from "../../db/schema";
import type { JmapStateType } from "./types";

type DBLike = DBInstance | TransactionInstance;

type ChangeLogParamsBase = {
	accountId: string;
	type: ChangeLogType;
	objectId: string;
	stateTypes?: readonly JmapStateType[];
	now?: Date;
};

type ChangeLogParams = ChangeLogParamsBase & {
	op: ChangeLogOp;
};

async function getNextModSeq(db: DBLike, accountId: string): Promise<number> {
	const rows = await db
		.select({ modSeq: jmapStateTable.modSeq })
		.from(jmapStateTable)
		.where(eq(jmapStateTable.accountId, accountId));

	if (!rows.length) return 1;

	let max = rows[0]!.modSeq;
	for (const row of rows) {
		if (row.modSeq > max) max = row.modSeq;
	}
	return max + 1;
}

async function updateStateRows(
	db: DBLike,
	accountId: string,
	stateTypes: readonly JmapStateType[],
	modSeq: number
): Promise<void> {
	for (const type of stateTypes) {
		await db
			.insert(jmapStateTable)
			.values({ accountId, type, modSeq })
			.onConflictDoUpdate({
				target: [jmapStateTable.accountId, jmapStateTable.type],
				set: { modSeq },
			});
	}
}

function defaultStateTypesForChangeType(type: ChangeLogType): readonly JmapStateType[] {
	// ChangeLogType and JmapStateType currently share the same string literals
	return [type as JmapStateType];
}

export async function recordChange(db: DBLike, params: ChangeLogParams): Promise<number> {
	const { accountId, type, objectId, op, now, stateTypes } = params;

	const modSeq = await getNextModSeq(db, accountId);
	const affectedTypes =
		stateTypes && stateTypes.length > 0 ? stateTypes : defaultStateTypesForChangeType(type);

	const createdAt = now ?? new Date();

	await db.insert(changeLogTable).values({
		id: crypto.randomUUID(),
		accountId,
		type,
		objectId,
		op,
		modSeq,
		createdAt,
	});

	await updateStateRows(db, accountId, affectedTypes, modSeq);

	return modSeq;
}

export async function recordCreate(db: DBLike, params: ChangeLogParamsBase): Promise<number> {
	return recordChange(db, { ...params, op: "create" });
}

export async function recordUpdate(db: DBLike, params: ChangeLogParamsBase): Promise<number> {
	return recordChange(db, { ...params, op: "update" });
}

export async function recordDestroy(db: DBLike, params: ChangeLogParamsBase): Promise<number> {
	return recordChange(db, { ...params, op: "destroy" });
}

/**
 * Convenience helper if you ever need the current global state string
 * from inside a handler without re-implementing the logic from jmap.routes.
 */
export async function getGlobalAccountStateString(db: DBLike, accountId: string): Promise<string> {
	const rows = await db
		.select({ modSeq: jmapStateTable.modSeq })
		.from(jmapStateTable)
		.where(eq(jmapStateTable.accountId, accountId));

	if (!rows.length) return "0";

	let max = rows[0]!.modSeq;
	for (const row of rows) {
		if (row.modSeq > max) max = row.modSeq;
	}
	return String(max);
}
