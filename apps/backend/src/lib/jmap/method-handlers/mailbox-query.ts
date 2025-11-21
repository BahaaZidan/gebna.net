import { and, asc, desc, eq, like, or } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { mailboxTable } from "../../../db/schema";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";

type MailboxFilter = {
	operator: "all" | "text" | "name" | "role";
	value?: string;
};

type MailboxSort = {
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

const DEFAULT_MAILBOX_SORT: MailboxSort[] = [{ property: "sortOrder", isAscending: true }];

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
	const queryState = await getAccountState(db, effectiveAccountId, "Mailbox");

	const options = parseQueryOptions(args);

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

	return [
		"Mailbox/query",
		{
			accountId: effectiveAccountId,
			queryState,
			canCalculateChanges: options.filter.operator === "all",
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
		filter: normalizeFilter(args.filter),
		sort: normalizeSort(args.sort),
		limit,
		position,
		calculateTotal,
	};
}

function normalizeFilter(raw: unknown): MailboxFilter {
	if (!raw || typeof raw !== "object") return { operator: "all" };
	const value = raw as Record<string, unknown>;

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

	return { operator: "all" };
}

function normalizeSort(raw: unknown): MailboxSort[] {
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

function applyFilter(accountId: string, filter: MailboxFilter) {
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
		case "all":
		default:
			return base;
	}
}

function buildOrderBy(sort: MailboxSort[]) {
	if (!sort.length) return [asc(mailboxTable.sortOrder)];
	return sort.map((entry) => {
		if (entry.property === "name") {
			return entry.isAscending ? asc(mailboxTable.name) : desc(mailboxTable.name);
		}
		return entry.isAscending ? asc(mailboxTable.sortOrder) : desc(mailboxTable.sortOrder);
	});
}
