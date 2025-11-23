import { and, eq, lt } from "drizzle-orm";

import { jmapQueryStateTable } from "../../../db/schema";
import { getDB } from "../../../db";

const QUERY_STATE_PREFIX = "qs:";
const QUERY_STATE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type StoredQueryStateRecord = {
	filter: unknown;
	sort: unknown;
};

export function encodeQueryStateValue(stateId: string, modSeq: string): string {
	return `${QUERY_STATE_PREFIX}${stateId}:${modSeq}`;
}

export function decodeQueryStateValue(value: string): { id: string; modSeq: string } | null {
	if (!value.startsWith(QUERY_STATE_PREFIX)) return null;
	const trimmed = value.slice(QUERY_STATE_PREFIX.length);
	const idx = trimmed.indexOf(":");
	if (idx === -1) return null;
	return {
		id: trimmed.slice(0, idx),
		modSeq: trimmed.slice(idx + 1),
	};
}

export function filtersEqual(a: unknown, b: unknown): boolean {
	return stableJsonStringify(a ?? null) === stableJsonStringify(b ?? null);
}

export async function persistQueryStateRecord(
	db: ReturnType<typeof getDB>,
	accountId: string,
	filterInput: unknown,
	sortInput: unknown
): Promise<string> {
	const now = new Date();
	const id = crypto.randomUUID();
	const filterJson = filterInput === undefined ? null : stableJsonStringify(filterInput);
	const sortJson = sortInput ? stableJsonStringify(sortInput) : null;

	await db.insert(jmapQueryStateTable).values({
		id,
		accountId,
		filterJson,
		sortJson,
		createdAt: now,
		lastAccessedAt: now,
	});

	return id;
}

export async function loadQueryStateRecord(
	db: ReturnType<typeof getDB>,
	accountId: string,
	id: string
): Promise<StoredQueryStateRecord | null> {
	const [row] = await db
		.select({
			filterJson: jmapQueryStateTable.filterJson,
			sortJson: jmapQueryStateTable.sortJson,
		})
		.from(jmapQueryStateTable)
		.where(and(eq(jmapQueryStateTable.id, id), eq(jmapQueryStateTable.accountId, accountId)))
		.limit(1);

	if (!row) {
		return null;
	}

	await db
		.update(jmapQueryStateTable)
		.set({ lastAccessedAt: new Date() })
		.where(eq(jmapQueryStateTable.id, id));

	return {
		filter: row.filterJson ? JSON.parse(row.filterJson) : null,
		sort: row.sortJson ? JSON.parse(row.sortJson) : null,
	};
}

export async function purgeStaleQueryStates(db: ReturnType<typeof getDB>): Promise<void> {
	const cutoff = new Date(Date.now() - QUERY_STATE_TTL_MS);
	await db.delete(jmapQueryStateTable).where(lt(jmapQueryStateTable.lastAccessedAt, cutoff));
}

function stableJsonStringify(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableJsonStringify(item)).join(",")}]`;
	}

	if (value && typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => a.localeCompare(b));

		return `{${entries.map(([key, v]) => `${JSON.stringify(key)}:${stableJsonStringify(v)}`).join(",")}}`;
	}

	return JSON.stringify(value ?? null);
}
