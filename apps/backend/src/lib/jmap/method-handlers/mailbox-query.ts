import { and, asc, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { mailboxTable } from "../../../db/schema";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";
import {
	encodeQueryStateValue,
	persistQueryStateRecord,
	purgeStaleQueryStates,
} from "../helpers/query-state";

export type MailboxFilter =
	| { operator: "all" }
	| { operator: "text"; value: string }
	| { operator: "name"; value: string }
	| { operator: "role"; value: string }
	| { operator: "parentId"; value: string | null }
	| { operator: "isSubscribed"; value: boolean };

export type MailboxSort = {
	property: "name" | "sortOrder";
	isAscending?: boolean;
};

type MailboxQueryOptions = {
	filter: MailboxFilter;
	sort: MailboxSort[];
	position: number;
	limit: number;
	calculateTotal: boolean;
};

export const DEFAULT_MAILBOX_SORT: MailboxSort[] = [{ property: "sortOrder", isAscending: true }];

class MailboxQueryProblem extends Error {
	readonly type: string;

	constructor(type: string, message: string) {
		super(message);
		this.type = type;
	}
}

export async function handleMailboxQuery(
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
	const mailboxState = await getAccountState(db, effectiveAccountId, "Mailbox");

	let options: MailboxQueryOptions;
	try {
		options = parseQueryOptions(args);
	} catch (err) {
		if (err instanceof MailboxQueryProblem) {
			return ["error", { type: err.type, description: err.message }, tag];
		}
		throw err;
	}

	const rows = await db
		.select({ id: mailboxTable.id })
		.from(mailboxTable)
		.where(applyFilter(effectiveAccountId, options.filter))
		.orderBy(...buildOrderBy(options.sort))
		.offset(options.position)
		.limit(options.limit);

	const ids = rows.map((r) => r.id);
	let total: number | null = null;
	if (options.calculateTotal) {
		const [{ count } = { count: 0 }] = await db
			.select({ count: mailboxTable.id })
			.from(mailboxTable)
			.where(applyFilter(effectiveAccountId, options.filter));
		total = typeof count === "number" ? count : 0;
	}

	let queryStateId: string | null = null;
	try {
		queryStateId = await persistQueryStateRecord(db, effectiveAccountId, options.filter, options.sort);
		await purgeStaleQueryStates(db);
	} catch (err) {
		console.warn("Failed to persist mailbox queryState", err);
	}
	const encodedQueryState =
		queryStateId !== null ? encodeQueryStateValue(queryStateId, mailboxState) : mailboxState;
	const canCalculateChanges = options.filter.operator === "all" && Boolean(queryStateId);

	return [
		"Mailbox/query",
		{
			accountId: effectiveAccountId,
			queryState: encodedQueryState,
			canCalculateChanges,
			ids,
			position: options.position,
			total: options.calculateTotal ? total : null,
		},
		tag,
	];
}

function parseQueryOptions(args: Record<string, unknown>): MailboxQueryOptions {
	const limit =
		typeof args.limit === "number" && Number.isFinite(args.limit) && args.limit > 0
			? Math.min(args.limit, 500)
			: 50;
	const position =
		typeof args.position === "number" && Number.isFinite(args.position) && args.position >= 0
			? args.position
			: 0;
	const calculateTotal = Boolean(args.calculateTotal) || Boolean(args.calculateChanges);

	return {
		filter: normalizeMailboxFilter(args.filter),
		sort: normalizeMailboxSort(args.sort),
		limit,
		position,
		calculateTotal,
	};
}

export function normalizeMailboxFilter(raw: unknown): MailboxFilter {
	if (!raw || typeof raw !== "object") return { operator: "all" };
	const value = raw as Record<string, unknown>;
	const allowedKeys = new Set(["text", "name", "role", "parentId", "isSubscribed"]);
	for (const key of Object.keys(value)) {
		if (!allowedKeys.has(key)) {
			throw new MailboxQueryProblem("unsupportedFilter", `Unsupported filter property ${key}`);
		}
	}

	const text = value.text;
	if (typeof text === "string" && text.trim()) {
		return { operator: "text", value: text.trim() };
	}

	const name = value.name;
	if (typeof name === "string" && name.trim()) {
		return { operator: "name", value: name.trim() };
	}

	const role = value.role;
	if (typeof role === "string" && role.trim()) {
		return { operator: "role", value: role.trim().toLowerCase() };
	}

	if (value.parentId !== undefined) {
		if (value.parentId === null) {
			return { operator: "parentId", value: null };
		}
		if (typeof value.parentId === "string" && value.parentId.trim()) {
			return { operator: "parentId", value: value.parentId };
		}
		throw new MailboxQueryProblem("invalidArguments", "parentId must be a string or null");
	}

	if (value.isSubscribed !== undefined) {
		if (typeof value.isSubscribed !== "boolean") {
			throw new MailboxQueryProblem("invalidArguments", "isSubscribed must be a boolean");
		}
		return { operator: "isSubscribed", value: value.isSubscribed };
	}

	return { operator: "all" };
}

export function normalizeMailboxSort(raw: unknown): MailboxSort[] {
	if (!Array.isArray(raw) || raw.length === 0) {
		return DEFAULT_MAILBOX_SORT;
	}
	const converted: MailboxSort[] = [];
	for (const entry of raw) {
		if (!entry || typeof entry !== "object") continue;
		const sortEntry = entry as { property?: string; isAscending?: boolean };
		if (sortEntry.property === "name" || sortEntry.property === "sortOrder") {
			converted.push({
				property: sortEntry.property,
				isAscending: typeof sortEntry.isAscending === "boolean" ? sortEntry.isAscending : true,
			});
		}
	}
	return converted.length > 0 ? converted : DEFAULT_MAILBOX_SORT;
}

export function applyFilter(accountId: string, filter: MailboxFilter) {
	const base = eq(mailboxTable.accountId, accountId);
	switch (filter.operator) {
		case "text": {
			const pattern = `%${filter.value?.replace(/[%_]/g, (ch) => `\\${ch}`)}%`;
			return and(base, or(like(mailboxTable.name, pattern), like(mailboxTable.role, pattern)));
		}
		case "name": {
			const pattern = `%${filter.value?.replace(/[%_]/g, (ch) => `\\${ch}`)}%`;
			return and(base, like(mailboxTable.name, pattern));
		}
		case "role": {
			return and(base, eq(mailboxTable.role, filter.value ?? ""));
		}
		case "parentId": {
			if (filter.value === null) {
				return and(base, isNull(mailboxTable.parentId));
			}
			return and(base, eq(mailboxTable.parentId, filter.value));
		}
		case "isSubscribed": {
			if (filter.value) {
				return base;
			}
			return and(base, sql`1 = 0`);
		}
		case "all":
		default:
			return base;
	}
}

export function buildOrderBy(sort: MailboxSort[]) {
	if (!sort.length) return [asc(mailboxTable.sortOrder)];
	return sort.map((entry) => {
		if (entry.property === "name") {
			return entry.isAscending ? asc(mailboxTable.name) : desc(mailboxTable.name);
		}
		return entry.isAscending ? asc(mailboxTable.sortOrder) : desc(mailboxTable.sortOrder);
	});
}
