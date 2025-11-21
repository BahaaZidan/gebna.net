import { and, asc, desc, eq, gt, inArray, like, lt, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import {
	accountMessageTable,
	addressTable,
	emailKeywordTable,
	jmapQueryStateTable,
	mailboxMessageTable,
	messageAddressTable,
	messageTable,
} from "../../../db/schema";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";

type FilterCondition =
	| { operator: "none" }
	| { operator: "text"; value: string }
	| { operator: "subject"; value: string }
	| { operator: "from"; value: string }
	| { operator: "to"; value: string }
	| { operator: "cc"; value: string }
	| { operator: "bcc"; value: string }
	| { operator: "after"; value: Date }
	| { operator: "before"; value: Date }
	| { operator: "sizeLarger"; value: number }
	| { operator: "sizeSmaller"; value: number }
	| { operator: "hasKeyword"; keyword: string }
	| { operator: "inMailbox"; mailboxId: string }
	| { operator: "inMailboxOtherThan"; mailboxIds: string[] }
	| { operator: "and" | "or"; conditions: FilterCondition[] }
	| { operator: "not"; condition: FilterCondition };

type SortComparator = {
	property: "receivedAt" | "sentAt" | "size";
	isAscending?: boolean;
};

type QueryOptions = {
	limit: number;
	position: number;
	sort: SortComparator[];
	filter: FilterCondition;
	calculateTotal: boolean;
	anchor?: { id: string; offset: number };
};

const DEFAULT_SORT: SortComparator[] = [{ property: "receivedAt", isAscending: false }];
const QUERY_STATE_PREFIX = "qs:";

export type StoredQueryStateRecord = {
	filter: unknown;
	sort: SortComparator[] | null;
};

function encodeQueryStateValue(stateId: string, modSeq: string): string {
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

async function persistQueryStateRecord(
	db: ReturnType<typeof getDB>,
	accountId: string,
	filterInput: unknown,
	sortInput: SortComparator[]
): Promise<string> {
	const now = new Date();
	const id = crypto.randomUUID();
	const filterJson = filterInput === undefined ? null : stableJsonStringify(filterInput);
	const sortJson = sortInput && sortInput.length > 0 ? stableJsonStringify(sortInput) : null;

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
		sort: row.sortJson ? (JSON.parse(row.sortJson) as SortComparator[]) : null,
	};
}

export function filtersEqual(a: unknown, b: unknown): boolean {
	return stableJsonStringify(a ?? null) === stableJsonStringify(b ?? null);
}

function escapeLikePattern(input: string): string {
	return input.replace(/[\\_%]/g, (ch) => `\\${ch}`);
}

export async function handleEmailQuery(
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
	const accountState = await getAccountState(db, effectiveAccountId, "Email");

	const options = parseQueryOptions(args);

	try {
		const result = await runQuery(db, effectiveAccountId, options);
		const queryStateId = await persistQueryStateRecord(
			db,
			effectiveAccountId,
			args.filter ?? null,
			options.sort
		);
		const encodedQueryState = encodeQueryStateValue(queryStateId, accountState);
		return [
			"Email/query",
			{
				accountId: effectiveAccountId,
				queryState: encodedQueryState,
				canCalculateChanges: result.canCalculateChanges,
				ids: result.ids,
				position: result.position,
				total: options.calculateTotal ? result.total : null,
			},
			tag,
		];
	} catch (err) {
		if (err instanceof EmailQueryProblem) {
			return ["error", { type: err.type, description: err.message }, tag];
		}
		console.error("Email/query error", err);
		return ["error", { type: "serverError" }, tag];
	}
}

class EmailQueryProblem extends Error {
	readonly type: string;

	constructor(type: string, message: string) {
		super(message);
		this.type = type;
	}
}

function parseSort(raw: unknown): SortComparator[] {
	if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_SORT;
	const result: SortComparator[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const comparator = item as { property?: string; isAscending?: boolean };
		if (
			comparator.property === "receivedAt" ||
			comparator.property === "sentAt" ||
			comparator.property === "size"
		) {
			result.push({
				property: comparator.property,
				isAscending: typeof comparator.isAscending === "boolean" ? comparator.isAscending : false,
			});
		}
	}
	return result.length ? result : DEFAULT_SORT;
}

function parseAnchor(args: Record<string, unknown>): { id: string; offset: number } | undefined {
	if (typeof args.anchor === "string" && args.anchor) {
		const offset =
			typeof args.anchorOffset === "number" && Number.isFinite(args.anchorOffset)
				? args.anchorOffset
				: 0;
		return { id: args.anchor, offset };
	}
	return undefined;
}

function parseQueryOptions(args: Record<string, unknown>): QueryOptions {
	const limit =
		typeof args.limit === "number" && Number.isFinite(args.limit) && args.limit > 0
			? Math.min(args.limit, 500)
			: 50;
	const position =
		typeof args.position === "number" && Number.isFinite(args.position) && args.position >= 0
			? args.position
			: 0;

	return {
		limit,
		position,
		sort: parseSort(args.sort),
		filter: normalizeFilter(args.filter),
		calculateTotal: Boolean(args.calculateTotal) || Boolean(args.calculateChanges),
		anchor: parseAnchor(args),
	};
}

export function normalizeFilter(raw: unknown): FilterCondition {
	if (!raw || typeof raw !== "object") return { operator: "none" };
	const value = raw as Record<string, unknown>;
	const conditions: FilterCondition[] = [];

	const pushCondition = (condition: FilterCondition | undefined) => {
		if (!condition) return;
		if (condition.operator === "none") return;
		conditions.push(condition);
	};

	const stringProp = (prop: string) => {
		const input = value[prop];
		if (typeof input === "string" && input.trim()) {
			return input.trim();
		}
		return null;
	};

	const text = stringProp("text");
	if (text) pushCondition({ operator: "text", value: text });

	const subject = stringProp("subject");
	if (subject) pushCondition({ operator: "subject", value: subject });

	const from = stringProp("from");
	if (from) pushCondition({ operator: "from", value: from });

	const to = stringProp("to");
	if (to) pushCondition({ operator: "to", value: to });

	const cc = stringProp("cc");
	if (cc) pushCondition({ operator: "cc", value: cc });

	const bcc = stringProp("bcc");
	if (bcc) pushCondition({ operator: "bcc", value: bcc });

	if (typeof value.after === "string") {
		const date = new Date(value.after);
		if (!Number.isNaN(date.getTime())) {
			pushCondition({ operator: "after", value: date });
		}
	}

	if (typeof value.before === "string") {
		const date = new Date(value.before);
		if (!Number.isNaN(date.getTime())) {
			pushCondition({ operator: "before", value: date });
		}
	}

	if (typeof value.sizeLarger === "number" && Number.isFinite(value.sizeLarger)) {
		pushCondition({ operator: "sizeLarger", value: value.sizeLarger });
	}

	if (typeof value.sizeSmaller === "number" && Number.isFinite(value.sizeSmaller)) {
		pushCondition({ operator: "sizeSmaller", value: value.sizeSmaller });
	}

	if (typeof value.inMailbox === "string" && value.inMailbox) {
		pushCondition({ operator: "inMailbox", mailboxId: value.inMailbox });
	}

	if (Array.isArray(value.inMailboxOtherThan) && value.inMailboxOtherThan.length > 0) {
		const cleaned = value.inMailboxOtherThan.filter((id): id is string => typeof id === "string");
		if (cleaned.length) {
			pushCondition({ operator: "inMailboxOtherThan", mailboxIds: cleaned });
		}
	}

	if (typeof value.hasKeyword === "string" && value.hasKeyword) {
		pushCondition({ operator: "hasKeyword", keyword: value.hasKeyword });
	}

	if (Array.isArray(value.and)) {
		const subConditions = value.and
			.map((entry) => normalizeFilter(entry))
			.filter((entry) => entry.operator !== "none");
		if (subConditions.length === 1) {
			pushCondition(subConditions[0]);
		} else if (subConditions.length > 1) {
			pushCondition({ operator: "and", conditions: subConditions });
		}
	}

	if (Array.isArray(value.or)) {
		const subConditions = value.or
			.map((entry) => normalizeFilter(entry))
			.filter((entry) => entry.operator !== "none");
		if (subConditions.length === 1) {
			pushCondition(subConditions[0]);
		} else if (subConditions.length > 0) {
			pushCondition({ operator: "or", conditions: subConditions });
		}
	}

	if (value.not !== undefined) {
		const sub = normalizeFilter(value.not);
		if (sub.operator !== "none") {
			pushCondition({ operator: "not", condition: sub });
		}
	}

	if (conditions.length === 0) {
		return { operator: "none" };
	}
	if (conditions.length === 1) {
		return conditions[0]!;
	}
	return {
		operator: "and",
		conditions,
	};
}

async function runQuery(
	db: ReturnType<typeof getDB>,
	accountId: string,
	options: QueryOptions
): Promise<{ ids: string[]; total: number | null; position: number; canCalculateChanges: boolean }> {
	const filterWhere = buildWhereClause(accountId, options.filter);
	const orderParts = buildOrderBy(options.sort);
	const orderForWindow = sql.join(orderParts, sql`, `);

	let start = options.position;

	if (options.anchor) {
		const rowNumberExpr = sql<number>`row_number() over (ORDER BY ${orderForWindow}) - 1`.as("rowIndex");
		const anchorRows = await db
			.select({ rowIndex: rowNumberExpr })
			.from(accountMessageTable)
			.innerJoin(messageTable, eq(accountMessageTable.messageId, messageTable.id))
			.where(and(filterWhere, eq(accountMessageTable.id, options.anchor.id)))
			.limit(1);

		if (!anchorRows.length) {
			throw new EmailQueryProblem("anchorNotFound", "anchor was not found");
		}
		const baseIndex = anchorRows[0]!.rowIndex ?? 0;
		start = Math.max(baseIndex + options.anchor.offset, 0);
	}

	const rows = await db
		.select({
			emailId: accountMessageTable.id,
		})
		.from(accountMessageTable)
		.innerJoin(messageTable, eq(accountMessageTable.messageId, messageTable.id))
		.where(filterWhere)
		.orderBy(...orderParts)
		.limit(options.limit)
		.offset(start);

	let total: number | null = null;
	if (options.calculateTotal) {
		const [{ count } = { count: 0 }] = await db
			.select({ count: sql<number>`count(*)` })
			.from(accountMessageTable)
			.innerJoin(messageTable, eq(accountMessageTable.messageId, messageTable.id))
			.where(filterWhere);
		total = count ?? 0;
	}

	return {
		ids: rows.map((row) => row.emailId),
		total,
		position: start,
		canCalculateChanges: options.filter.operator === "none",
	};
}

export async function filterIdsMatchingQuery(
	db: ReturnType<typeof getDB>,
	accountId: string,
	filter: FilterCondition,
	ids: string[]
): Promise<Set<string>> {
	if (!ids.length) {
		return new Set();
	}
	if (filter.operator === "none") {
		return new Set(ids);
	}

	const rows = await db
		.select({ emailId: accountMessageTable.id })
		.from(accountMessageTable)
		.innerJoin(messageTable, eq(accountMessageTable.messageId, messageTable.id))
		.where(and(buildWhereClause(accountId, filter), inArray(accountMessageTable.id, ids)));

	return new Set(rows.map((row) => row.emailId));
}

function buildWhereClause(accountId: string, filter: FilterCondition) {
	const base = eq(accountMessageTable.accountId, accountId);
	const filterClause = buildFilterSql(filter);
	return filterClause ? and(base, filterClause) : base;
}

function buildOrderBy(sort: SortComparator[]) {
	const clauses = [];
	for (const comparator of sort) {
		switch (comparator.property) {
			case "receivedAt":
				clauses.push(
					comparator.isAscending ? asc(accountMessageTable.internalDate) : desc(accountMessageTable.internalDate)
				);
				break;
			case "sentAt":
				clauses.push(
					comparator.isAscending ? asc(messageTable.sentAt) : desc(messageTable.sentAt)
				);
				break;
			case "size":
				clauses.push(comparator.isAscending ? asc(messageTable.size) : desc(messageTable.size));
				break;
			default:
				break;
		}
	}
	return clauses.length ? clauses : [desc(accountMessageTable.internalDate)];
}

function buildFilterSql(filter: FilterCondition): SQL | undefined {
	switch (filter.operator) {
		case "none":
			return undefined;
		case "text": {
			const pattern = `%${escapeLikePattern(filter.value)}%`;
			return or(like(messageTable.subject, pattern), like(messageTable.snippet, pattern));
		}
		case "subject": {
			const pattern = `%${escapeLikePattern(filter.value)}%`;
			return like(messageTable.subject, pattern);
		}
		case "from":
			return buildAddressCondition("from", filter.value);
		case "to":
			return buildAddressCondition("to", filter.value);
		case "cc":
			return buildAddressCondition("cc", filter.value);
		case "bcc":
			return buildAddressCondition("bcc", filter.value);
		case "after":
			return gt(accountMessageTable.internalDate, filter.value);
		case "before":
			return lt(accountMessageTable.internalDate, filter.value);
		case "sizeLarger":
			return gt(messageTable.size, filter.value);
		case "sizeSmaller":
			return lt(messageTable.size, filter.value);
		case "hasKeyword":
			return buildKeywordCondition(filter.keyword);
		case "inMailbox":
			return sql`exists(select 1 from ${mailboxMessageTable} mm where mm.account_message_id = ${accountMessageTable.id} and mm.mailbox_id = ${filter.mailboxId})`;
		case "inMailboxOtherThan": {
			const list = filter.mailboxIds.map((id) => sql`${id}`);
			return sql`not exists(select 1 from ${mailboxMessageTable} mm where mm.account_message_id = ${accountMessageTable.id} and mm.mailbox_id in (${sql.join(list, sql`, `)}))`;
		}
		case "and": {
			const conditions = filter.conditions
				.map((cond) => buildFilterSql(cond))
				.filter((cond): cond is ReturnType<typeof sql> => Boolean(cond));
			return conditions.length ? and(...conditions) : undefined;
		}
		case "or": {
			const conditions = filter.conditions
				.map((cond) => buildFilterSql(cond))
				.filter((cond): cond is ReturnType<typeof sql> => Boolean(cond));
			return conditions.length ? or(...conditions) : undefined;
		}
		case "not": {
			const inner = buildFilterSql(filter.condition);
			return inner ? sql`not (${inner})` : undefined;
		}
	}
}

function buildAddressCondition(kind: string, value: string): SQL {
	const pattern = `%${escapeLikePattern(value)}%`;
	return sql`exists(select 1 from ${messageAddressTable} ma inner join ${addressTable} addr on ma.address_id = addr.id where ma.message_id = ${messageTable.id} and ma.kind = ${kind} and addr.email like ${pattern})`;
}

function buildKeywordCondition(keyword: string): SQL {
	switch (keyword.toLowerCase()) {
		case "$seen":
			return eq(accountMessageTable.isSeen, true);
		case "$flagged":
			return eq(accountMessageTable.isFlagged, true);
		case "$answered":
			return eq(accountMessageTable.isAnswered, true);
		case "$draft":
			return eq(accountMessageTable.isDraft, true);
		default:
			return sql`exists(select 1 from ${emailKeywordTable} ek where ek.account_message_id = ${accountMessageTable.id} and ek.keyword = ${keyword})`;
	}
}
