import { and, eq, sql } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../db";
import { changeLogTable, jmapStateTable, mailboxTable } from "../../db/schema";
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
	updatedProperties: string[] | null;
};

export async function getChanges(
	db: ReturnType<typeof getDB>,
	accountId: string,
	type: JmapStateType,
	sinceState: string,
	maxChanges: number,
	options?: { upToId?: string; includeUpdatedProperties?: boolean }
): Promise<ChangesResult & { updatedProperties: string[] | null }> {
	const since = Number(sinceState);
	if (!Number.isFinite(since) || since < 0) {
		throw Object.assign(new Error("invalid sinceState"), {
			jmapType: "cannotCalculateChanges",
		});
	}

	const shouldCollectProperties = Boolean(options?.includeUpdatedProperties);
	const rows = await db
		.select({
			objectId: changeLogTable.objectId,
			modSeq: changeLogTable.modSeq,
			op: changeLogTable.op,
			updatedPropsJson: changeLogTable.updatedPropertiesJson,
		})
		.from(changeLogTable)
		.where(
			and(
				eq(changeLogTable.accountId, accountId),
				eq(changeLogTable.type, type),
				options?.upToId
					? sql`${changeLogTable.modSeq} > ${since} and ${changeLogTable.modSeq} <= ${options.upToId}`
					: sql`${changeLogTable.modSeq} > ${since}`
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
			updatedProperties: shouldCollectProperties ? [] : null,
		};
	}

const hasMoreChanges = rows.length > maxChanges;
	const slice = hasMoreChanges ? rows.slice(0, maxChanges) : rows;

	const perId = new Map<
		string,
		{ firstOp: (typeof rows)[number]["op"]; lastOp: (typeof rows)[number]["op"] }
	>();

	const updatedPropertySet = shouldCollectProperties ? new Set<string>() : null;
	const appendUpdatedProps = (json: string | null | undefined) => {
		if (!shouldCollectProperties || !updatedPropertySet || !json) return;
		try {
			const parsed = JSON.parse(json);
			if (Array.isArray(parsed)) {
				for (const prop of parsed) {
					if (typeof prop === "string" && prop.length > 0) {
						updatedPropertySet.add(prop);
					}
				}
			}
		} catch (err) {
			console.warn("Failed to parse updatedPropertiesJson", err);
		}
	};

	for (const row of slice) {
		appendUpdatedProps(row.updatedPropsJson);
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
	const updatedProperties = shouldCollectProperties
		? Array.from(updatedPropertySet ?? [])
		: null;

	return {
		oldState: sinceState,
		newState,
		created,
		updated,
		destroyed,
		hasMoreChanges,
		updatedProperties,
	};
}

export type AccountMailboxInfo = {
	id: string;
	role: string | null;
};

export type AccountMailboxLookup = {
	byId: Map<string, AccountMailboxInfo>;
	byRole: Map<string, AccountMailboxInfo>;
};

export async function getAccountMailboxes(
	db: ReturnType<typeof getDB>,
	accountId: string
): Promise<AccountMailboxLookup> {
	const rows = await db
		.select({
			id: mailboxTable.id,
			role: mailboxTable.role,
		})
		.from(mailboxTable)
		.where(eq(mailboxTable.accountId, accountId));

	const byId = new Map<string, AccountMailboxInfo>();
	const byRole = new Map<string, AccountMailboxInfo>();

	for (const row of rows) {
		const info: AccountMailboxInfo = { id: row.id, role: row.role };
		byId.set(row.id, info);
		if (row.role) {
			byRole.set(row.role, info);
		}
	}

	return { byId, byRole };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRequestedProperties(
	value: unknown,
	allowed: readonly string[]
): { properties: Set<string> | null } | { error: string } {
	if (value === undefined) {
		return { properties: null };
	}
	if (!Array.isArray(value)) {
		return { error: "properties must be an array of strings" };
	}
	const allowedSet = new Set(allowed);
	const properties = new Set<string>();
	for (const entry of value) {
		if (typeof entry !== "string" || entry.length === 0) {
			return { error: "properties must be non-empty strings" };
		}
		if (!allowedSet.has(entry)) {
			return { error: `Unsupported property ${entry}` };
		}
		properties.add(entry);
	}
	return { properties };
}
