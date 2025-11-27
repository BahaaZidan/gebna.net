import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { Context } from "hono";

import { getDB, TransactionInstance } from "../../../db";
import { accountTable, identityTable } from "../../../db/schema";
import { recordCreate, recordDestroy, recordUpdate } from "../change-log";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState, isRecord } from "../utils";

type IdentityAddress = { email: string; name?: string | null };

type IdentityCreate = {
	name: string;
	email: string;
	replyTo?: IdentityAddress[] | null;
	bcc?: IdentityAddress[] | null;
	textSignature?: string | null;
	htmlSignature?: string | null;
	isDefault?: boolean;
};

type IdentityUpdate = {
	name?: string;
	email?: string;
	replyTo?: IdentityAddress[] | null;
	bcc?: IdentityAddress[] | null;
	textSignature?: string | null;
	htmlSignature?: string | null;
	isDefault?: boolean;
};

function serializeAddressList(list: IdentityAddress[] | null | undefined): string | null {
	if (!list || list.length === 0) return null;
	return JSON.stringify(
		list.map((item) => ({
			email: item.email,
			name: item.name ?? null,
		}))
	);
}

function parseAddressList(value: unknown): IdentityAddress[] | null | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (!Array.isArray(value)) {
		return undefined;
	}
	const normalized: IdentityAddress[] = [];
	for (const entry of value) {
		if (!isRecord(entry)) continue;
		if (typeof entry.email !== "string" || entry.email.length === 0) continue;
		if (entry.name !== undefined && entry.name !== null && typeof entry.name !== "string") continue;
		normalized.push({ email: entry.email, name: entry.name ?? null });
	}
	return normalized;
}

class IdentitySetProblem extends Error {
	readonly type: string;

	constructor(type: string, message: string) {
		super(message);
		this.type = type;
	}
}

function parseIdentityCreate(raw: unknown, _accountAddress: string): IdentityCreate {
	if (!isRecord(raw)) {
		throw new IdentitySetProblem("invalidProperties", "Identity/create patch must be an object");
	}

	let name = "";
	if (raw.name === null || raw.name === undefined) {
		name = "";
	} else if (typeof raw.name === "string") {
		name = raw.name;
	} else {
		throw new IdentitySetProblem("invalidProperties", "Identity/create.name must be a string or null");
	}

	const email = raw.email;
	if (typeof email !== "string" || email.length === 0) {
		throw new IdentitySetProblem("invalidProperties", "Identity/create.email must be a string");
	}

	const replyTo = parseAddressList(raw.replyTo);
	if (replyTo === undefined && raw.replyTo !== undefined) {
		throw new IdentitySetProblem("invalidProperties", "Identity/create.replyTo must be an array or null");
	}
	const bcc = parseAddressList(raw.bcc);
	if (bcc === undefined && raw.bcc !== undefined) {
		throw new IdentitySetProblem("invalidProperties", "Identity/create.bcc must be an array or null");
	}

	let textSignature: string | null | undefined = undefined;
	if (raw.textSignature !== undefined) {
		if (raw.textSignature !== null && typeof raw.textSignature !== "string") {
			throw new IdentitySetProblem("invalidProperties", "textSignature must be string or null");
		}
		textSignature = raw.textSignature;
	}

	let htmlSignature: string | null | undefined = undefined;
	if (raw.htmlSignature !== undefined) {
		if (raw.htmlSignature !== null && typeof raw.htmlSignature !== "string") {
			throw new IdentitySetProblem("invalidProperties", "htmlSignature must be string or null");
		}
		htmlSignature = raw.htmlSignature;
	}
	const isDefault = typeof raw.isDefault === "boolean" ? raw.isDefault : undefined;

	return {
		name,
		email,
		replyTo,
		bcc,
		textSignature,
		htmlSignature,
		isDefault,
	};
}

function parseIdentityUpdate(raw: unknown, _accountAddress: string): IdentityUpdate {
	if (!isRecord(raw)) {
		throw new IdentitySetProblem("invalidProperties", "Identity/update patch must be an object");
	}

	const patch: IdentityUpdate = {};

	if (raw.name !== undefined) {
		if (raw.name !== null && typeof raw.name !== "string") {
			throw new IdentitySetProblem("invalidProperties", "Identity/update.name must be a string or null");
		}
		patch.name = raw.name ?? "";
	}

	if (raw.email !== undefined) {
		if (raw.email === null || typeof raw.email !== "string" || raw.email.length === 0) {
			throw new IdentitySetProblem("invalidProperties", "Identity/update.email must be a string");
		}
		patch.email = raw.email;
	}

	if (raw.replyTo !== undefined) {
		const list = parseAddressList(raw.replyTo);
		if (list === undefined) {
			throw new IdentitySetProblem("invalidProperties", "Identity/update.replyTo must be an array or null");
		}
		patch.replyTo = list;
	}

	if (raw.bcc !== undefined) {
		const list = parseAddressList(raw.bcc);
		if (list === undefined) {
			throw new IdentitySetProblem("invalidProperties", "Identity/update.bcc must be an array or null");
		}
		patch.bcc = list;
	}

	if (raw.textSignature !== undefined) {
		if (raw.textSignature !== null && typeof raw.textSignature !== "string") {
			throw new IdentitySetProblem("invalidProperties", "textSignature must be string or null");
		}
		patch.textSignature = raw.textSignature;
	}

	if (raw.htmlSignature !== undefined) {
		if (raw.htmlSignature !== null && typeof raw.htmlSignature !== "string") {
			throw new IdentitySetProblem("invalidProperties", "htmlSignature must be string or null");
		}
		patch.htmlSignature = raw.htmlSignature;
	}

	if (raw.isDefault !== undefined) {
		if (typeof raw.isDefault !== "boolean") {
			throw new IdentitySetProblem("invalidProperties", "isDefault must be boolean");
		}
		patch.isDefault = raw.isDefault;
	}

	return patch;
}

async function identityEmailExists(
	tx: TransactionInstance,
	accountId: string,
	email: string,
	excludeId?: string
): Promise<boolean> {
	const normalizedEmail = email.trim().toLowerCase();
	const emailCondition = sql`lower(trim(${identityTable.email})) = ${normalizedEmail}`;
	let whereClause = and(eq(identityTable.accountId, accountId), emailCondition);
	if (excludeId) {
		whereClause = and(whereClause, ne(identityTable.id, excludeId));
	}
	const rows = await tx
		.select({ id: identityTable.id })
		.from(identityTable)
		.where(whereClause)
		.limit(1);
	return rows.length > 0;
}

async function ensureSingleDefaultIdentity(
	tx: TransactionInstance,
	accountId: string,
	preferredId: string | null,
	now: Date
): Promise<void> {
	const rows = await tx
		.select({ id: identityTable.id, isDefault: identityTable.isDefault })
		.from(identityTable)
		.where(eq(identityTable.accountId, accountId));

	if (rows.length === 0) return;

	let targetId = preferredId;
	if (!targetId) {
		const existing = rows.find((row) => row.isDefault);
		if (existing) {
			targetId = existing.id;
		} else {
			targetId = rows[0]!.id;
		}
	}

	for (const row of rows) {
		if (row.id === targetId) {
			if (!row.isDefault) {
				await tx
					.update(identityTable)
					.set({ isDefault: true, updatedAt: now })
					.where(eq(identityTable.id, row.id));
			}
		} else if (row.isDefault) {
			await tx
				.update(identityTable)
				.set({ isDefault: false, updatedAt: now })
				.where(eq(identityTable.id, row.id));
		}
	}
}

export async function handleIdentitySet(
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

	const accountRow = await db
		.select({ address: accountTable.address })
		.from(accountTable)
		.where(eq(accountTable.id, effectiveAccountId))
		.limit(1);
	if (!accountRow.length) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const accountAddress = accountRow[0]!.address;
	const oldState = await getAccountState(db, effectiveAccountId, "Identity");
	const ifInState = args.ifInState as string | undefined;
	if (ifInState && ifInState !== oldState) {
		return ["error", { type: "stateMismatch" }, tag];
	}

	const createMap = (args.create as Record<string, unknown> | undefined) ?? {};
	const updateMap = (args.update as Record<string, unknown> | undefined) ?? {};
	const destroyIds = (args.destroy as string[] | undefined) ?? [];

	const maxSetObjects = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInSet ?? 128;
	const createCount = Object.keys(createMap).length;
	const updateCount = Object.keys(updateMap).length;
	const destroyCount = destroyIds.length;
	if (createCount > maxSetObjects) {
		return [
			"error",
			{
				type: "requestTooLarge",
				description: `create exceeds maxObjectsInSet (${maxSetObjects})`,
			},
			tag,
		];
	}
	if (updateCount > maxSetObjects) {
		return [
			"error",
			{
				type: "requestTooLarge",
				description: `update exceeds maxObjectsInSet (${maxSetObjects})`,
			},
			tag,
		];
	}
	if (destroyCount > maxSetObjects) {
		return [
			"error",
			{
				type: "requestTooLarge",
				description: `destroy exceeds maxObjectsInSet (${maxSetObjects})`,
			},
			tag,
		];
	}

	const created: Record<string, unknown> = {};
	const notCreated: Record<string, { type: string; description?: string }> = {};
	const updated: Record<string, unknown> = {};
	const notUpdated: Record<string, { type: string; description?: string }> = {};
	const destroyed: string[] = [];
	const notDestroyed: Record<string, { type: string; description?: string }> = {};

	const now = new Date();

	await db.transaction(async (tx) => {
		for (const [creationId, raw] of Object.entries(createMap)) {
			let parsed: IdentityCreate;
			try {
				parsed = parseIdentityCreate(raw, accountAddress);
			} catch (err) {
				if (err instanceof IdentitySetProblem) {
					notCreated[creationId] = { type: err.type, description: err.message };
					continue;
				}
				throw err;
			}

			if (await identityEmailExists(tx, effectiveAccountId, parsed.email)) {
				notCreated[creationId] = {
					type: "invalidProperties",
					description: "Identity email already in use",
				};
				continue;
			}

			const id = crypto.randomUUID();

			await tx.insert(identityTable).values({
				id,
				accountId: effectiveAccountId,
				name: parsed.name,
				email: parsed.email,
				replyToJson: serializeAddressList(parsed.replyTo),
				bccJson: serializeAddressList(parsed.bcc),
				textSignature: parsed.textSignature ?? null,
				htmlSignature: parsed.htmlSignature ?? null,
				isDefault: parsed.isDefault ?? false,
				createdAt: now,
				updatedAt: now,
			});

			await ensureSingleDefaultIdentity(tx, effectiveAccountId, parsed.isDefault ? id : null, now);
			await recordCreate(tx, {
				accountId: effectiveAccountId,
				type: "Identity",
				objectId: id,
				now,
			});
			created[creationId] = { id };
		}

		for (const [id, raw] of Object.entries(updateMap)) {
			const [row] = await tx
				.select({
					id: identityTable.id,
					isDefault: identityTable.isDefault,
				})
				.from(identityTable)
				.where(and(eq(identityTable.id, id), eq(identityTable.accountId, effectiveAccountId)))
				.limit(1);

			if (!row) {
				notUpdated[id] = { type: "notFound", description: "Identity not found" };
				continue;
			}

			let patch: IdentityUpdate;
			try {
				patch = parseIdentityUpdate(raw, accountAddress);
			} catch (err) {
				if (err instanceof IdentitySetProblem) {
					notUpdated[id] = { type: err.type, description: err.message };
					continue;
				}
				throw err;
			}

			if (Object.keys(patch).length === 0) {
				continue;
			}

			if (patch.email !== undefined) {
				const emailInUse = await identityEmailExists(tx, effectiveAccountId, patch.email, id);
				if (emailInUse) {
					notUpdated[id] = {
						type: "invalidProperties",
						description: "Identity email already in use",
					};
					continue;
				}
			}

			await tx
				.update(identityTable)
				.set({
					...(patch.name !== undefined ? { name: patch.name } : {}),
					...(patch.email !== undefined ? { email: patch.email } : {}),
					...(patch.replyTo !== undefined ? { replyToJson: serializeAddressList(patch.replyTo) } : {}),
					...(patch.bcc !== undefined ? { bccJson: serializeAddressList(patch.bcc) } : {}),
					...(patch.textSignature !== undefined ? { textSignature: patch.textSignature } : {}),
					...(patch.htmlSignature !== undefined ? { htmlSignature: patch.htmlSignature } : {}),
					...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
					updatedAt: now,
				})
				.where(eq(identityTable.id, id));

			await ensureSingleDefaultIdentity(
				tx,
				effectiveAccountId,
				patch.isDefault ? id : null,
				now
			);
			await recordUpdate(tx, {
				accountId: effectiveAccountId,
				type: "Identity",
				objectId: id,
				now,
				updatedProperties: Object.keys(patch),
			});
			updated[id] = { id };
		}

		if (destroyIds.length > 0) {
			const rows = await tx
				.select({ id: identityTable.id })
				.from(identityTable)
				.where(and(eq(identityTable.accountId, effectiveAccountId), inArray(identityTable.id, destroyIds)));

			const existingIds = new Set(rows.map((row) => row.id));

			for (const id of destroyIds) {
				if (!existingIds.has(id)) {
					notDestroyed[id] = { type: "notFound", description: "Identity not found" };
					continue;
				}

				await tx.delete(identityTable).where(eq(identityTable.id, id));
				await ensureSingleDefaultIdentity(tx, effectiveAccountId, null, now);
				await recordDestroy(tx, {
					accountId: effectiveAccountId,
					type: "Identity",
					objectId: id,
					now,
				});
				destroyed.push(id);
			}
		}
	});

	const newState = await getAccountState(db, effectiveAccountId, "Identity");

	return [
		"Identity/set",
		{
			accountId: effectiveAccountId,
			oldState,
			newState,
			created,
			notCreated,
			updated,
			notUpdated,
			destroyed,
			notDestroyed,
		},
		tag,
	];
}
