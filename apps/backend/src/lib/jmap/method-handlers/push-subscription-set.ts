import { and, eq } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { pushSubscriptionTable } from "../../../db/schema";
import { recordCreate, recordUpdate } from "../change-log";
import { JMAP_CONSTRAINTS, JMAP_CORE, JMAP_PUSH } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse, JmapStateType } from "../types";
import { ensureAccountAccess, getAccountState, isRecord } from "../utils";

type PushSubscriptionKeys = { auth?: string | null; p256dh?: string | null } | null;

type PushSubscriptionCreate = {
	deviceClientId: string;
	url: string;
	keys: PushSubscriptionKeys;
	types: JmapStateType[] | null;
	expiresAt: Date | null;
	verificationCode: string | null;
};

type PushSubscriptionUpdate = {
	deviceClientId?: string;
	url?: string;
	keys?: PushSubscriptionKeys;
	types?: JmapStateType[] | null;
	expiresAt?: Date | null;
	verificationCode?: string | null;
};

const PUSH_SUBSCRIPTION_TYPES: readonly JmapStateType[] = [
	"Email",
	"Mailbox",
	"Thread",
	"Identity",
	"VacationResponse",
	"EmailSubmission",
	"PushSubscription",
];
const PUSH_TYPE_SET = new Set(PUSH_SUBSCRIPTION_TYPES);

class PushSubscriptionProblem extends Error {
	readonly type: string;

	constructor(type: string, message: string) {
		super(message);
		this.type = type;
	}
}

export async function handlePushSubscriptionSet(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);
	const effectiveAccountId = ensureAccountAccess(c, args.accountId as string | undefined);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const createMap = isRecord(args.create) ? (args.create as Record<string, unknown>) : {};
	const updateMap = isRecord(args.update) ? (args.update as Record<string, unknown>) : {};
	const createEntries = Object.entries(createMap);
	const updateEntries = Object.entries(updateMap);

	const maxSetObjects = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInSet ?? 128;
	if (createEntries.length + updateEntries.length > maxSetObjects) {
		return [
			"error",
			{
				type: "limitExceeded",
				description: `Too many create/update operations (max ${maxSetObjects})`,
			},
			tag,
		];
	}

	const oldState = await getAccountState(db, effectiveAccountId, "PushSubscription");
	const maxSubscriptions = JMAP_CONSTRAINTS[JMAP_PUSH]?.maxSubscriptionsPerAccount ?? Number.MAX_SAFE_INTEGER;

	const created: Record<string, { id: string }> = {};
	const notCreated: Record<string, { type: string; description?: string }> = {};
	const updated: Record<string, { id: string }> = {};
	const notUpdated: Record<string, { type: string; description?: string }> = {};

	try {
		await db.transaction(async (tx) => {
			if (createEntries.length > 0 && Number.isFinite(maxSubscriptions)) {
				const existing = await tx
					.select({ id: pushSubscriptionTable.id })
					.from(pushSubscriptionTable)
					.where(eq(pushSubscriptionTable.accountId, effectiveAccountId));
				if (existing.length + createEntries.length > maxSubscriptions) {
					throw Object.assign(
						new Error(`maxSubscriptionsPerAccount (${maxSubscriptions}) exceeded`),
						{ jmapType: "limitExceeded" }
					);
				}
			}

			for (const [creationId, raw] of createEntries) {
				let parsed: PushSubscriptionCreate;
				try {
					parsed = parsePushSubscriptionCreate(raw);
				} catch (err) {
					if (err instanceof PushSubscriptionProblem) {
						notCreated[creationId] = { type: err.type, description: err.message };
						continue;
					}
					throw err;
				}

				const [existingForDevice] = await tx
					.select({ id: pushSubscriptionTable.id })
					.from(pushSubscriptionTable)
					.where(
						and(
							eq(pushSubscriptionTable.accountId, effectiveAccountId),
							eq(pushSubscriptionTable.deviceClientId, parsed.deviceClientId)
						)
					)
					.limit(1);

				if (existingForDevice) {
					notCreated[creationId] = {
						type: "invalidProperties",
						description: "deviceClientId is already registered",
					};
					continue;
				}

				const now = new Date();
				const id = crypto.randomUUID();
				await tx.insert(pushSubscriptionTable).values({
					id,
					accountId: effectiveAccountId,
					deviceClientId: parsed.deviceClientId,
					url: parsed.url,
					keysAuth: parsed.keys?.auth ?? null,
					keysP256dh: parsed.keys?.p256dh ?? null,
					typesJson: serializeTypes(parsed.types),
					verificationCode: parsed.verificationCode,
					expiresAt: parsed.expiresAt ?? null,
					createdAt: now,
					updatedAt: now,
				});

				await recordCreate(tx, {
					accountId: effectiveAccountId,
					type: "PushSubscription",
					objectId: id,
					now,
				});

				created[creationId] = { id };
			}

			for (const [id, raw] of updateEntries) {
				const [existing] = await tx
					.select({
						id: pushSubscriptionTable.id,
						deviceClientId: pushSubscriptionTable.deviceClientId,
					})
					.from(pushSubscriptionTable)
					.where(and(eq(pushSubscriptionTable.id, id), eq(pushSubscriptionTable.accountId, effectiveAccountId)))
					.limit(1);

				if (!existing) {
					notUpdated[id] = { type: "notFound", description: "PushSubscription not found" };
					continue;
				}

				let patch: PushSubscriptionUpdate;
				try {
					patch = parsePushSubscriptionUpdate(raw);
				} catch (err) {
					if (err instanceof PushSubscriptionProblem) {
						notUpdated[id] = { type: err.type, description: err.message };
						continue;
					}
					throw err;
				}

				const updateData: Record<string, unknown> = {};
				if (patch.deviceClientId !== undefined && patch.deviceClientId !== existing.deviceClientId) {
					const [conflict] = await tx
						.select({ id: pushSubscriptionTable.id })
						.from(pushSubscriptionTable)
						.where(
							and(
								eq(pushSubscriptionTable.accountId, effectiveAccountId),
								eq(pushSubscriptionTable.deviceClientId, patch.deviceClientId)
							)
						)
						.limit(1);
					if (conflict) {
						notUpdated[id] = { type: "invalidProperties", description: "deviceClientId is already registered" };
						continue;
					}
					updateData.deviceClientId = patch.deviceClientId;
				}
				if (patch.url !== undefined) {
					updateData.url = patch.url;
				}
				if (patch.keys !== undefined) {
					updateData.keysAuth = patch.keys?.auth ?? null;
					updateData.keysP256dh = patch.keys?.p256dh ?? null;
				}
				if (patch.types !== undefined) {
					updateData.typesJson = serializeTypes(patch.types);
				}
				if (patch.expiresAt !== undefined) {
					updateData.expiresAt = patch.expiresAt ?? null;
				}
				if (patch.verificationCode !== undefined) {
					updateData.verificationCode = patch.verificationCode;
				}

				if (Object.keys(updateData).length === 0) {
					continue;
				}

				const now = new Date();
				updateData.updatedAt = now;

				await tx.update(pushSubscriptionTable).set(updateData).where(eq(pushSubscriptionTable.id, id));

				await recordUpdate(tx, {
					accountId: effectiveAccountId,
					type: "PushSubscription",
					objectId: id,
					now,
				});
				updated[id] = { id };
			}
		});
	} catch (err) {
		if ((err as { jmapType?: string }).jmapType === "limitExceeded") {
			return ["error", { type: "limitExceeded", description: (err as Error).message }, tag];
		}
		console.error("PushSubscription/set error", err);
		return ["error", { type: "serverError" }, tag];
	}

	const newState = await getAccountState(db, effectiveAccountId, "PushSubscription");

	return [
		"PushSubscription/set",
		{
			accountId: effectiveAccountId,
			oldState,
			newState,
			created,
			notCreated,
			updated,
			notUpdated,
		},
		tag,
	];
}

function parsePushSubscriptionCreate(raw: unknown): PushSubscriptionCreate {
	if (!isRecord(raw)) {
		throw new PushSubscriptionProblem("invalidArguments", "PushSubscription/create must be an object");
	}
	const deviceClientId = parseDeviceClientId(raw.deviceClientId);
	const url = parseUrl(raw.url);
	const keys = parseKeys(raw.keys);
	const types = parseTypesInput(raw.types);
	const expiresAt = parseExpires(raw.expires);
	const verificationCode = parseOptionalString(raw.verificationCode);

	return {
		deviceClientId,
		url,
		keys,
		types,
		expiresAt,
		verificationCode,
	};
}

function parsePushSubscriptionUpdate(raw: unknown): PushSubscriptionUpdate {
	if (!isRecord(raw)) {
		throw new PushSubscriptionProblem("invalidArguments", "PushSubscription/update patch must be an object");
	}

	const patch: PushSubscriptionUpdate = {};
	if (raw.deviceClientId !== undefined) {
		patch.deviceClientId = parseDeviceClientId(raw.deviceClientId);
	}
	if (raw.url !== undefined) {
		patch.url = parseUrl(raw.url);
	}
	if (raw.keys !== undefined) {
		patch.keys = parseKeys(raw.keys);
	}
	if (raw.types !== undefined) {
		patch.types = parseTypesInput(raw.types);
	}
	if (raw.expires !== undefined) {
		patch.expiresAt = parseExpires(raw.expires);
	}
	if (raw.verificationCode !== undefined) {
		patch.verificationCode = parseOptionalString(raw.verificationCode);
	}

	return patch;
}

function parseDeviceClientId(value: unknown): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new PushSubscriptionProblem("invalidProperties", "deviceClientId must be a non-empty string");
	}
	return value.trim();
}

function parseUrl(value: unknown): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new PushSubscriptionProblem("invalidProperties", "url must be a non-empty string");
	}
	try {
		const parsed = new URL(value);
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
			throw new Error("Invalid protocol");
		}
		return parsed.toString();
	} catch {
		throw new PushSubscriptionProblem("invalidProperties", "url must be a valid http(s) URL");
	}
}

function parseKeys(value: unknown): PushSubscriptionKeys {
	if (value === undefined) return null;
	if (value === null) return null;
	if (!isRecord(value)) {
		throw new PushSubscriptionProblem("invalidProperties", "keys must be an object or null");
	}
	const keys: PushSubscriptionKeys = {};
	if (value.auth !== undefined) {
		if (typeof value.auth !== "string" || value.auth.length === 0) {
			throw new PushSubscriptionProblem("invalidProperties", "keys.auth must be a non-empty string");
		}
		keys.auth = value.auth;
	}
	if (value.p256dh !== undefined) {
		if (typeof value.p256dh !== "string" || value.p256dh.length === 0) {
			throw new PushSubscriptionProblem("invalidProperties", "keys.p256dh must be a non-empty string");
		}
		keys.p256dh = value.p256dh;
	}
	if (!keys.auth && !keys.p256dh) {
		return null;
	}
	return keys;
}

function parseTypesInput(value: unknown): JmapStateType[] | null {
	if (value === undefined) return null;
	if (value === null) return null;
	if (!Array.isArray(value)) {
		throw new PushSubscriptionProblem("invalidProperties", "types must be an array or null");
	}
	const normalized: JmapStateType[] = [];
	for (const entry of value) {
		if (typeof entry !== "string" || !PUSH_TYPE_SET.has(entry as JmapStateType)) {
			throw new PushSubscriptionProblem("invalidProperties", "types must only include supported state names");
		}
		normalized.push(entry as JmapStateType);
	}
	return normalized;
}

function parseExpires(value: unknown): Date | null {
	if (value === undefined || value === null) return null;
	if (typeof value === "string") {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			throw new PushSubscriptionProblem("invalidProperties", "expires must be a valid date string");
		}
		return date;
	}
	throw new PushSubscriptionProblem("invalidProperties", "expires must be an ISO date string or null");
}

function parseOptionalString(value: unknown): string | null {
	if (value === undefined || value === null) return null;
	if (typeof value !== "string") {
		throw new PushSubscriptionProblem("invalidProperties", "verificationCode must be a string or null");
	}
	return value;
}

function serializeTypes(types: JmapStateType[] | null): string | null {
	if (types === null) return null;
	return Array.isArray(types) ? JSON.stringify(types) : null;
}
