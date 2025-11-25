import { and, eq, inArray } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { identityTable } from "../../../db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState, parseRequestedProperties } from "../utils";

type IdentityAddress = { email: string; name?: string | null };

type IdentityRecord = {
	id: string;
	name?: string | null;
	email?: string;
	replyTo?: IdentityAddress[] | null;
	bcc?: IdentityAddress[] | null;
	textSignature?: string | null;
	htmlSignature?: string | null;
	isDefault?: boolean;
};

const IDENTITY_PROPERTIES = [
	"id",
	"name",
	"email",
	"replyTo",
	"bcc",
	"textSignature",
	"htmlSignature",
	"isDefault",
] as const;

function parseAddressJson(json: string | null): IdentityAddress[] | null {
	if (!json) return null;
	try {
		const parsed = JSON.parse(json);
		if (!Array.isArray(parsed)) return null;
		const normalized: IdentityAddress[] = [];
		for (const item of parsed) {
			if (typeof item !== "object" || item === null) continue;
			const email = typeof item.email === "string" ? item.email : null;
			if (!email) continue;
			normalized.push({ email, name: typeof item.name === "string" ? item.name : null });
		}
		return normalized.length ? normalized : null;
	} catch {
		return null;
	}
}

export async function handleIdentityGet(
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

	const state = await getAccountState(db, effectiveAccountId, "Identity");
	const ids = (args.ids as string[] | undefined) ?? null;
	const maxObjects = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	if (Array.isArray(ids) && ids.length > maxObjects) {
		return [
			"error",
			{
				type: "limitExceeded",
				description: `ids length exceeds maxObjectsInGet (${maxObjects})`,
			},
			tag,
		];
	}

	const propertiesResult = parseRequestedProperties(args.properties, IDENTITY_PROPERTIES);
	if ("error" in propertiesResult) {
		return ["error", { type: "invalidArguments", description: propertiesResult.error }, tag];
	}
	const requestedProperties = propertiesResult.properties;
	const includeProp = (prop: (typeof IDENTITY_PROPERTIES)[number]) =>
		!requestedProperties || requestedProperties.has(prop);

	const rows = await (ids?.length
		? db
				.select({
					id: identityTable.id,
					name: identityTable.name,
					email: identityTable.email,
					replyToJson: identityTable.replyToJson,
					bccJson: identityTable.bccJson,
					textSignature: identityTable.textSignature,
					htmlSignature: identityTable.htmlSignature,
					isDefault: identityTable.isDefault,
				})
				.from(identityTable)
				.where(and(eq(identityTable.accountId, effectiveAccountId), inArray(identityTable.id, ids)))
		: db
				.select({
					id: identityTable.id,
					name: identityTable.name,
					email: identityTable.email,
					replyToJson: identityTable.replyToJson,
					bccJson: identityTable.bccJson,
					textSignature: identityTable.textSignature,
					htmlSignature: identityTable.htmlSignature,
					isDefault: identityTable.isDefault,
				})
				.from(identityTable)
				.where(eq(identityTable.accountId, effectiveAccountId))
				.limit(maxObjects));

	const list: IdentityRecord[] = rows.map((row) => {
		const entry: IdentityRecord = { id: row.id } as IdentityRecord;
		if (includeProp("name")) entry.name = row.name?.length ? row.name : null;
		if (includeProp("email")) entry.email = row.email;
		if (includeProp("replyTo")) entry.replyTo = parseAddressJson(row.replyToJson);
		if (includeProp("bcc")) entry.bcc = parseAddressJson(row.bccJson);
		if (includeProp("textSignature")) entry.textSignature = row.textSignature ?? null;
		if (includeProp("htmlSignature")) entry.htmlSignature = row.htmlSignature ?? null;
		if (includeProp("isDefault")) entry.isDefault = Boolean(row.isDefault);
		return entry;
	});

	const foundIds = new Set(list.map((r) => r.id));
	const notFound = ids ? ids.filter((id) => !foundIds.has(id)) : [];

	return [
		"Identity/get",
		{
			accountId: effectiveAccountId,
			state,
			list,
			notFound,
		},
		tag,
	];
}
