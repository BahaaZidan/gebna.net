import { and, eq, inArray } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { pushSubscriptionTable } from "../../../db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse, JmapStateType } from "../types";
import { ensureAccountAccess, getAccountState, parseRequestedProperties } from "../utils";

type PushSubscriptionResponse = {
	id: string;
	deviceClientId?: string;
	url?: string;
	keys?: { auth?: string | null; p256dh?: string | null } | null;
	types?: JmapStateType[] | null;
	expires?: string | null;
	verificationCode?: string | null;
};

const PUSH_SUBSCRIPTION_PROPERTIES = [
	"id",
	"deviceClientId",
	"url",
	"keys",
	"types",
	"expires",
	"verificationCode",
] as const;

const KNOWN_PUSH_TYPES: readonly JmapStateType[] = [
	"Email",
	"Mailbox",
	"Thread",
	"Identity",
	"VacationResponse",
	"EmailSubmission",
	"PushSubscription",
];
const KNOWN_PUSH_TYPE_SET = new Set(KNOWN_PUSH_TYPES);

export async function handlePushSubscriptionGet(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);
	const effectiveAccountId = ensureAccountAccess(c, args.accountId as string | undefined);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const state = await getAccountState(db, effectiveAccountId, "PushSubscription");
	const maxObjects = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;

	const idsInput = args.ids as string[] | undefined;
	if (Array.isArray(idsInput) && idsInput.length > maxObjects) {
		return [
			"error",
			{
				type: "limitExceeded",
				description: `ids length exceeds maxObjectsInGet (${maxObjects})`,
			},
			tag,
		];
	}

	const ids = Array.isArray(idsInput) ? idsInput.filter((id) => typeof id === "string" && id.length > 0) : null;

	const propertiesResult = parseRequestedProperties(args.properties, PUSH_SUBSCRIPTION_PROPERTIES);
	if ("error" in propertiesResult) {
		return ["error", { type: "invalidArguments", description: propertiesResult.error }, tag];
	}
	const requestedProperties = propertiesResult.properties;
	const includeProp = (prop: (typeof PUSH_SUBSCRIPTION_PROPERTIES)[number]) =>
		!requestedProperties || requestedProperties.has(prop);

	const rows = await (ids
		? db
				.select({
					id: pushSubscriptionTable.id,
					deviceClientId: pushSubscriptionTable.deviceClientId,
					url: pushSubscriptionTable.url,
					keysAuth: pushSubscriptionTable.keysAuth,
					keysP256dh: pushSubscriptionTable.keysP256dh,
					typesJson: pushSubscriptionTable.typesJson,
					expiresAt: pushSubscriptionTable.expiresAt,
					verificationCode: pushSubscriptionTable.verificationCode,
				})
				.from(pushSubscriptionTable)
				.where(and(eq(pushSubscriptionTable.accountId, effectiveAccountId), inArray(pushSubscriptionTable.id, ids)))
		: db
				.select({
					id: pushSubscriptionTable.id,
					deviceClientId: pushSubscriptionTable.deviceClientId,
					url: pushSubscriptionTable.url,
					keysAuth: pushSubscriptionTable.keysAuth,
					keysP256dh: pushSubscriptionTable.keysP256dh,
					typesJson: pushSubscriptionTable.typesJson,
					expiresAt: pushSubscriptionTable.expiresAt,
					verificationCode: pushSubscriptionTable.verificationCode,
				})
				.from(pushSubscriptionTable)
				.where(eq(pushSubscriptionTable.accountId, effectiveAccountId))
				.limit(maxObjects));

	const list: PushSubscriptionResponse[] = rows.map((row) => {
		const entry: PushSubscriptionResponse = { id: row.id } as PushSubscriptionResponse;
		if (includeProp("deviceClientId")) entry.deviceClientId = row.deviceClientId;
		if (includeProp("url")) entry.url = row.url;
		if (includeProp("keys")) entry.keys = formatKeys(row.keysAuth, row.keysP256dh);
		if (includeProp("types")) entry.types = parseTypes(row.typesJson);
		if (includeProp("expires")) {
			entry.expires = row.expiresAt ? new Date(row.expiresAt).toISOString() : null;
		}
		if (includeProp("verificationCode")) {
			entry.verificationCode = row.verificationCode ?? null;
		}
		return entry;
	});

	const foundIds = new Set(list.map((entry) => entry.id));
	const notFound = ids ? ids.filter((id) => !foundIds.has(id)) : [];

	return [
		"PushSubscription/get",
		{
			accountId: effectiveAccountId,
			state,
			list,
			notFound,
		},
		tag,
	];
}

function parseTypes(json: string | null): JmapStateType[] | null {
	if (!json) return null;
	try {
		const parsed = JSON.parse(json);
		if (!Array.isArray(parsed)) return null;
		const normalized: JmapStateType[] = [];
		for (const entry of parsed) {
			if (typeof entry === "string" && KNOWN_PUSH_TYPE_SET.has(entry as JmapStateType)) {
				normalized.push(entry as JmapStateType);
			}
		}
		return normalized.length > 0 ? normalized : null;
	} catch {
		return null;
	}
}

function formatKeys(auth: string | null, p256dh: string | null): { auth?: string | null; p256dh?: string | null } | null {
	const result: { auth?: string | null; p256dh?: string | null } = {};
	if (typeof auth === "string" && auth.length > 0) {
		result.auth = auth;
	}
	if (typeof p256dh === "string" && p256dh.length > 0) {
		result.p256dh = p256dh;
	}
	return Object.keys(result).length > 0 ? result : null;
}
