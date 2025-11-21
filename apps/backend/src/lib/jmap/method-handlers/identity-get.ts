import { and, eq, inArray } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { identityTable } from "../../../db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";

type IdentityAddress = { email: string; name?: string | null };

type IdentityRecord = {
	id: string;
	name: string;
	email: string;
	replyTo: IdentityAddress[] | null;
	bcc: IdentityAddress[] | null;
	textSignature: string | null;
	htmlSignature: string | null;
	isDefault: boolean;
};

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

	const list: IdentityRecord[] = rows.map((row) => ({
		id: row.id,
		name: row.name,
		email: row.email,
		replyTo: parseAddressJson(row.replyToJson),
		bcc: parseAddressJson(row.bccJson),
		textSignature: row.textSignature ?? null,
		htmlSignature: row.htmlSignature ?? null,
		isDefault: Boolean(row.isDefault),
	}));

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
