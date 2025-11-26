import { and, desc, eq, inArray } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { emailSubmissionTable } from "../../../db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState, parseRequestedProperties } from "../utils";

type EmailSubmissionRecord = { id: string } & Record<string, unknown>;

const EMAIL_SUBMISSION_PROPERTIES = [
	"id",
	"emailId",
	"identityId",
	"envelope",
	"sendAt",
	"status",
	"undoStatus",
	"deliveryStatus",
] as const;

export async function handleEmailSubmissionGet(
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
			.select({ id: emailSubmissionTable.id })
			.from(emailSubmissionTable)
			.where(eq(emailSubmissionTable.accountId, effectiveAccountId))
			.orderBy(desc(emailSubmissionTable.createdAt), desc(emailSubmissionTable.id))
			.limit(maxObjects);
		idsToFetch = defaultRows.map((row) => row.id);
	} else if (providedIds) {
		if (providedIds.length === 0) {
			return ["EmailSubmission/get", { accountId: effectiveAccountId, state, list: [], notFound: [] }, tag];
		}
		idsToFetch = providedIds;
	}

	if (!idsToFetch.length) {
		return ["EmailSubmission/get", { accountId: effectiveAccountId, state, list: [], notFound: [] }, tag];
	}

	const propertiesResult = parseRequestedProperties(args.properties, EMAIL_SUBMISSION_PROPERTIES);
	if ("error" in propertiesResult) {
		return ["error", { type: "invalidArguments", description: propertiesResult.error }, tag];
	}
	const requestedProperties = propertiesResult.properties;
	const includeProp = (prop: (typeof EMAIL_SUBMISSION_PROPERTIES)[number]) =>
		!requestedProperties || requestedProperties.has(prop);

	const rows = await db
		.select()
		.from(emailSubmissionTable)
		.where(and(eq(emailSubmissionTable.accountId, effectiveAccountId), inArray(emailSubmissionTable.id, idsToFetch)));

	const rowMap = new Map(rows.map((row) => [row.id, row]));
	const orderedIds = providedIds ?? idsToFetch;
	const list: EmailSubmissionRecord[] = orderedIds
		.map((id) => {
			const row = rowMap.get(id);
			if (!row) return null;
			const entry: EmailSubmissionRecord = { id: row.id };
			if (includeProp("emailId")) entry.emailId = row.emailId;
			if (includeProp("identityId")) entry.identityId = row.identityId;
			if (includeProp("envelope")) entry.envelope = row.envelopeJson ? JSON.parse(row.envelopeJson) : null;
			if (includeProp("sendAt")) entry.sendAt = row.sendAt?.toISOString() ?? null;
			if (includeProp("status")) entry.status = row.status;
			if (includeProp("undoStatus")) entry.undoStatus = row.undoStatus ?? "final";
			if (includeProp("deliveryStatus")) entry.deliveryStatus = row.deliveryStatusJson ?? null;
			return entry;
		})
		.filter((value): value is EmailSubmissionRecord => value !== null);

	const foundIds = new Set(list.map((item) => item.id));
	const notFound = providedIds ? providedIds.filter((id) => !foundIds.has(id)) : [];

	return [
		"EmailSubmission/get",
		{
			accountId: effectiveAccountId,
			state,
			list,
			notFound,
		},
		tag,
	];
}
