import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { emailSubmissionTable } from "../../../db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import {
	encodeQueryStateValue,
	persistQueryStateRecord,
	purgeStaleQueryStates,
} from "../helpers/query-state";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";

const DEFAULT_LIMIT = 50;
const SUPPORTED_UNDO_STATUSES = new Set(["pending", "final", "canceled"]);

export type EmailSubmissionFilter = {
	identityIds?: string[];
	emailIds?: string[];
	threadIds?: string[];
	undoStatus?: "pending" | "final" | "canceled";
	before?: string;
	after?: string;
};

export type EmailSubmissionSort = {
	property: "sentAt" | "emailId" | "threadId";
	isAscending?: boolean;
};

type EmailSubmissionQueryOptions = {
	filter: EmailSubmissionFilter;
	sort: EmailSubmissionSort[];
	position: number;
	limit: number;
	calculateTotal: boolean;
};

export const DEFAULT_EMAIL_SUBMISSION_SORT: EmailSubmissionSort[] = [
	{ property: "sentAt", isAscending: false },
];

export class EmailSubmissionQueryProblem extends Error {
	readonly type: string;

	constructor(type: string, message: string) {
		super(message);
		this.type = type;
	}
}

export async function handleEmailSubmissionQuery(
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
	const state = await getAccountState(db, effectiveAccountId, "EmailSubmission");

	let options: EmailSubmissionQueryOptions;
	try {
		options = parseQueryOptions(args);
	} catch (err) {
		if (err instanceof EmailSubmissionQueryProblem) {
			return ["error", { type: err.type, description: err.message }, tag];
		}
		throw err;
	}

	const filterCondition = applyEmailSubmissionFilter(effectiveAccountId, options.filter);
	const orderBy = buildEmailSubmissionOrderBy(options.sort);

	const rows = await db
		.select({ id: emailSubmissionTable.id })
		.from(emailSubmissionTable)
		.where(filterCondition)
		.orderBy(...orderBy)
		.offset(options.position)
		.limit(options.limit);

	const ids = rows.map((row) => row.id);
	let total: number | null = null;
	if (options.calculateTotal) {
		const [{ count } = { count: 0 }] = await db
			.select({ count: emailSubmissionTable.id })
			.from(emailSubmissionTable)
			.where(filterCondition);
		total = typeof count === "number" ? count : 0;
	}

	let queryStateId: string | null = null;
	try {
		queryStateId = await persistQueryStateRecord(
			db,
			effectiveAccountId,
			options.filter,
			options.sort
		);
		await purgeStaleQueryStates(db);
	} catch (err) {
		console.warn("Failed to persist EmailSubmission queryState", err);
	}

	const encodedQueryState =
		queryStateId !== null ? encodeQueryStateValue(queryStateId, state) : state;
	const canCalculateChanges = isTrivialFilter(options.filter) && Boolean(queryStateId);

	return [
		"EmailSubmission/query",
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

export function normalizeEmailSubmissionFilter(raw: unknown): EmailSubmissionFilter {
	if (!raw || typeof raw !== "object") {
		return {};
	}
	const value = raw as Record<string, unknown>;
	const filter: EmailSubmissionFilter = {};

	const identityIds = parseIdArray(value.identityIds, "identityIds");
	if (identityIds) filter.identityIds = identityIds;

	const emailIds = parseIdArray(value.emailIds, "emailIds");
	if (emailIds) filter.emailIds = emailIds;

	const threadIds = parseIdArray(value.threadIds, "threadIds");
	if (threadIds) filter.threadIds = threadIds;

	if (value.undoStatus !== undefined) {
		if (typeof value.undoStatus !== "string" || !SUPPORTED_UNDO_STATUSES.has(value.undoStatus)) {
			throw new EmailSubmissionQueryProblem(
				"invalidArguments",
				"undoStatus must be one of pending, final, or canceled"
			);
		}
		filter.undoStatus = value.undoStatus as EmailSubmissionFilter["undoStatus"];
	}

	if (value.before !== undefined) {
		filter.before = parseDateValue(value.before, "before");
	}
	if (value.after !== undefined) {
		filter.after = parseDateValue(value.after, "after");
	}

	return filter;
}

export function normalizeEmailSubmissionSort(raw: unknown): EmailSubmissionSort[] {
	if (!Array.isArray(raw) || raw.length === 0) {
		return DEFAULT_EMAIL_SUBMISSION_SORT;
	}
	const converted: EmailSubmissionSort[] = [];
	for (const entry of raw) {
		if (!entry || typeof entry !== "object") continue;
		const sortEntry = entry as { property?: string; isAscending?: boolean };
		if (
			sortEntry.property === "sentAt" ||
			sortEntry.property === "emailId" ||
			sortEntry.property === "threadId"
		) {
			converted.push({
				property: sortEntry.property,
				isAscending: typeof sortEntry.isAscending === "boolean" ? sortEntry.isAscending : true,
			});
		}
	}
	return converted.length > 0 ? converted : DEFAULT_EMAIL_SUBMISSION_SORT;
}

export function applyEmailSubmissionFilter(
	accountId: string,
	filter: EmailSubmissionFilter
) {
	const clauses = [eq(emailSubmissionTable.accountId, accountId)];
	if (filter.identityIds && filter.identityIds.length > 0) {
		clauses.push(inArray(emailSubmissionTable.identityId, filter.identityIds));
	}
	if (filter.emailIds && filter.emailIds.length > 0) {
		clauses.push(inArray(emailSubmissionTable.emailId, filter.emailIds));
	}
	if (filter.threadIds && filter.threadIds.length > 0) {
		clauses.push(inArray(emailSubmissionTable.threadId, filter.threadIds));
	}
	if (filter.undoStatus) {
		clauses.push(eq(emailSubmissionTable.undoStatus, filter.undoStatus));
	}
	if (filter.before) {
		clauses.push(lt(emailSubmissionTable.sendAt, new Date(filter.before)));
	}
	if (filter.after) {
		clauses.push(gte(emailSubmissionTable.sendAt, new Date(filter.after)));
	}
	return and(...clauses);
}

export function buildEmailSubmissionOrderBy(sort: EmailSubmissionSort[]) {
	const orderBy = sort.map((entry) => {
		const direction = entry.isAscending === false ? desc : asc;
		switch (entry.property) {
			case "emailId":
				return direction(emailSubmissionTable.emailId);
			case "threadId":
				return direction(emailSubmissionTable.threadId);
			default:
				return direction(emailSubmissionTable.sendAt);
		}
	});
	orderBy.push(desc(emailSubmissionTable.id));
	return orderBy;
}

export function isTrivialFilter(filter: EmailSubmissionFilter): boolean {
	return (
		!filter.identityIds &&
		!filter.emailIds &&
		!filter.threadIds &&
		!filter.undoStatus &&
		!filter.before &&
		!filter.after
	);
}

function parseQueryOptions(args: Record<string, unknown>): EmailSubmissionQueryOptions {
	const maxLimit = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	const limitArg =
		typeof args.limit === "number" && Number.isFinite(args.limit) && args.limit > 0
			? Math.min(args.limit, maxLimit)
			: Math.min(DEFAULT_LIMIT, maxLimit);
	const position =
		typeof args.position === "number" && Number.isFinite(args.position) && args.position >= 0
			? args.position
			: 0;
	const calculateTotal = Boolean(args.calculateTotal) || Boolean(args.calculateChanges);

	return {
		filter: normalizeEmailSubmissionFilter(args.filter),
		sort: normalizeEmailSubmissionSort(args.sort),
		position,
		limit: limitArg,
		calculateTotal,
	};
}

function parseIdArray(value: unknown, field: string): string[] | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (!Array.isArray(value)) {
		throw new EmailSubmissionQueryProblem(
			"invalidArguments",
			`${field} must be an array of strings`
		);
	}
	const entries = value
		.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
		.map((entry) => entry.trim());
	const deduped = Array.from(new Set(entries));
	if (!deduped.length) {
		throw new EmailSubmissionQueryProblem(
			"invalidArguments",
			`${field} must include at least one non-empty string`
		);
	}
	return deduped;
}

function parseDateValue(value: unknown, field: string): string {
	if (typeof value !== "string" || !value.trim()) {
		throw new EmailSubmissionQueryProblem(
			"invalidArguments",
			`${field} must be an RFC 3339 date string`
		);
	}
	const parsed = Date.parse(value);
	if (!Number.isFinite(parsed)) {
		throw new EmailSubmissionQueryProblem(
			"invalidArguments",
			`${field} must be an RFC 3339 date string`
		);
	}
	return new Date(parsed).toISOString();
}
