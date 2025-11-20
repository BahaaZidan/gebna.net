import { and, eq, sql } from "drizzle-orm";
import { Context } from "hono";

import { getDB, type TransactionInstance } from "../../../db";
import { mailboxMessageTable, mailboxTable } from "../../../db/schema";
import { recordCreate, recordDestroy, recordUpdate } from "../change-log";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState, isRecord } from "../utils";

type MailboxInfo = {
	id: string;
	name: string;
	parentId: string | null;
	role: string | null;
	sortOrder: number;
};

type MailboxCreate = {
	name: string;
	parentId: string | null;
	role: string | null;
	sortOrder: number;
};

type MailboxUpdate = Partial<MailboxCreate>;

class MailboxSetProblem extends Error {
	readonly type: string;

	constructor(type: string, message: string) {
		super(message);
		this.type = type;
	}
}

function normalizeRole(value: string | null | undefined): string | null {
	if (value === undefined || value === null) return null;
	const trimmed = value.trim();
	return trimmed ? trimmed.toLowerCase() : null;
}

function parseMailboxCreate(raw: unknown): MailboxCreate {
	if (!isRecord(raw)) {
		throw new MailboxSetProblem("invalidProperties", "Mailbox/create patch must be an object");
	}

	const nameValue = raw.name;
	if (typeof nameValue !== "string" || nameValue.trim().length === 0) {
		throw new MailboxSetProblem("invalidProperties", "Mailbox name must be a non-empty string");
	}

	let sortOrder = 0;
	if (raw.sortOrder !== undefined) {
		if (typeof raw.sortOrder !== "number" || Number.isNaN(raw.sortOrder)) {
			throw new MailboxSetProblem("invalidProperties", "sortOrder must be a number");
		}
		sortOrder = raw.sortOrder;
	}

	let parentId: string | null = null;
	if (raw.parentId !== undefined) {
		if (raw.parentId === null) {
			parentId = null;
		} else if (typeof raw.parentId === "string" && raw.parentId.length > 0) {
			parentId = raw.parentId;
		} else {
			throw new MailboxSetProblem("invalidProperties", "parentId must be a string or null");
		}
	}

	let role: string | null = null;
	if (raw.role !== undefined) {
		if (raw.role === null) {
			role = null;
		} else if (typeof raw.role === "string") {
			role = normalizeRole(raw.role);
		} else {
			throw new MailboxSetProblem("invalidProperties", "role must be a string or null");
		}
	}

	return {
		name: nameValue.trim(),
		parentId,
		role,
		sortOrder,
	};
}

function parseMailboxUpdate(raw: unknown): MailboxUpdate {
	if (!isRecord(raw)) {
		throw new MailboxSetProblem("invalidProperties", "Mailbox/update patch must be an object");
	}

	const patch: MailboxUpdate = {};

	if (raw.name !== undefined) {
		if (raw.name === null || typeof raw.name !== "string" || raw.name.trim().length === 0) {
			throw new MailboxSetProblem("invalidProperties", "name must be a non-empty string");
		}
		patch.name = raw.name.trim();
	}

	if (raw.parentId !== undefined) {
		if (raw.parentId === null) {
			patch.parentId = null;
		} else if (typeof raw.parentId === "string" && raw.parentId.length > 0) {
			patch.parentId = raw.parentId;
		} else {
			throw new MailboxSetProblem("invalidProperties", "parentId must be a string or null");
		}
	}

	if (raw.role !== undefined) {
		if (raw.role === null) {
			patch.role = null;
		} else if (typeof raw.role === "string") {
			patch.role = normalizeRole(raw.role);
		} else {
			throw new MailboxSetProblem("invalidProperties", "role must be a string or null");
		}
	}

	if (raw.sortOrder !== undefined) {
		if (typeof raw.sortOrder !== "number" || Number.isNaN(raw.sortOrder)) {
			throw new MailboxSetProblem("invalidProperties", "sortOrder must be a number");
		}
		patch.sortOrder = raw.sortOrder;
	}

	return patch;
}

function resolveCreationId(ref: string | null, map: Map<string, string>): string | null {
	if (!ref) return null;
	if (!ref.startsWith("#")) return ref;
	const resolved = map.get(ref.slice(1));
	if (!resolved) {
		throw new MailboxSetProblem("invalidProperties", `Unknown creation id reference ${ref}`);
	}
	return resolved;
}

function ensureParentValid(
	mailboxes: Map<string, MailboxInfo>,
	parentId: string | null,
	childId: string
): void {
	if (!parentId) return;
	if (parentId === childId) {
		throw new MailboxSetProblem("invalidProperties", "parentId cannot reference the mailbox itself");
	}
	const parent = mailboxes.get(parentId);
	if (!parent) {
		throw new MailboxSetProblem("invalidProperties", "parentId does not exist");
	}

	let cursor = parent.parentId;
	while (cursor) {
		if (cursor === childId) {
			throw new MailboxSetProblem("invalidProperties", "parentId creates a cycle");
		}
		cursor = mailboxes.get(cursor)?.parentId ?? null;
	}
}

function ensureRoleAvailable(
	roleOwners: Map<string, string>,
	role: string | null,
	mailboxId: string
): void {
	if (!role) return;
	const owner = roleOwners.get(role);
	if (owner && owner !== mailboxId) {
		throw new MailboxSetProblem("roleConflict", `Role ${role} already assigned to another mailbox`);
	}
}

async function ensureMailboxEmpty(
	tx: TransactionInstance,
	mailboxId: string
): Promise<{ hasMessages: boolean }> {
	const [{ count } = { count: 0 }] = await tx
		.select({ count: sql<number>`count(*)` })
		.from(mailboxMessageTable)
		.where(eq(mailboxMessageTable.mailboxId, mailboxId));
	return { hasMessages: (count ?? 0) > 0 };
}

export async function handleMailboxSet(
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

	const oldState = await getAccountState(db, effectiveAccountId, "Mailbox");
	const createMap = (args.create as Record<string, unknown> | undefined) ?? {};
	const updateMap = (args.update as Record<string, unknown> | undefined) ?? {};
	const destroyList = (args.destroy as string[] | undefined) ?? [];

	const created: Record<string, unknown> = {};
	const notCreated: Record<string, { type: string; description?: string }> = {};
	const updated: Record<string, unknown> = {};
	const notUpdated: Record<string, { type: string; description?: string }> = {};
	const destroyed: string[] = [];
	const notDestroyed: Record<string, { type: string; description?: string }> = {};

	const now = new Date();

	try {
		await db.transaction(async (tx) => {
			const rows = await tx
				.select({
					id: mailboxTable.id,
					name: mailboxTable.name,
					parentId: mailboxTable.parentId,
					role: mailboxTable.role,
					sortOrder: mailboxTable.sortOrder,
				})
				.from(mailboxTable)
				.where(eq(mailboxTable.accountId, effectiveAccountId));

			const mailboxMap = new Map<string, MailboxInfo>();
			const roleOwners = new Map<string, string>();

			for (const row of rows) {
				const info: MailboxInfo = {
					id: row.id,
					name: row.name,
					parentId: row.parentId ?? null,
					role: row.role ?? null,
					sortOrder: row.sortOrder ?? 0,
				};
				mailboxMap.set(row.id, info);
				if (info.role) {
					roleOwners.set(info.role, info.id);
				}
			}

			const creationResults = new Map<string, string>();

			for (const [creationId, raw] of Object.entries(createMap)) {
				try {
					const parsed = parseMailboxCreate(raw);
					const resolvedParentId = resolveCreationId(parsed.parentId, creationResults);
					const mailboxId = crypto.randomUUID();

					ensureRoleAvailable(roleOwners, parsed.role, mailboxId);

					ensureParentValid(mailboxMap, resolvedParentId, mailboxId);

					await tx.insert(mailboxTable).values({
						id: mailboxId,
						accountId: effectiveAccountId,
						name: parsed.name,
						parentId: resolvedParentId,
						role: parsed.role,
						sortOrder: parsed.sortOrder,
						createdAt: now,
						updatedAt: now,
					});

					const info: MailboxInfo = {
						id: mailboxId,
						name: parsed.name,
						parentId: resolvedParentId,
						role: parsed.role,
						sortOrder: parsed.sortOrder,
					};
					mailboxMap.set(mailboxId, info);
					if (parsed.role) {
						roleOwners.set(parsed.role, mailboxId);
					}
					creationResults.set(creationId, mailboxId);
					created[creationId] = { id: mailboxId };

					await recordCreate(tx, {
						accountId: effectiveAccountId,
						type: "Mailbox",
						objectId: mailboxId,
						now,
					});
				} catch (err) {
					if (err instanceof MailboxSetProblem) {
						notCreated[creationId] = { type: err.type, description: err.message };
						continue;
					}
					throw err;
				}
			}

			for (const [mailboxId, raw] of Object.entries(updateMap)) {
				if (!mailboxId || mailboxId.startsWith("#")) {
					notUpdated[mailboxId] = {
						type: "invalidProperties",
						description: "Update id must be an existing mailbox id",
					};
					continue;
				}

				const existing = mailboxMap.get(mailboxId);
				if (!existing) {
					notUpdated[mailboxId] = { type: "notFound", description: "Mailbox not found" };
					continue;
				}

				try {
					const patch = parseMailboxUpdate(raw);
					if (Object.keys(patch).length === 0) {
						continue;
					}

					const nextParent = patch.parentId !== undefined ? patch.parentId : existing.parentId;
					const resolvedParent = resolveCreationId(nextParent ?? null, creationResults);
					const nextRole =
						patch.role !== undefined
							? normalizeRole(patch.role)
							: normalizeRole(existing.role ?? null);

					if (patch.role !== undefined) {
						ensureRoleAvailable(roleOwners, nextRole, mailboxId);
					}

					ensureParentValid(mailboxMap, resolvedParent ?? null, mailboxId);

					await tx
						.update(mailboxTable)
						.set({
							...(patch.name !== undefined ? { name: patch.name } : {}),
							...(patch.parentId !== undefined ? { parentId: resolvedParent } : {}),
							...(patch.role !== undefined ? { role: nextRole } : {}),
							...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
							updatedAt: now,
						})
						.where(and(eq(mailboxTable.id, mailboxId), eq(mailboxTable.accountId, effectiveAccountId)));

					if (patch.role !== undefined) {
						if (existing.role) {
							roleOwners.delete(existing.role);
						}
						if (nextRole) {
							roleOwners.set(nextRole, mailboxId);
						}
						existing.role = nextRole;
					}

					if (patch.parentId !== undefined) {
						existing.parentId = resolvedParent ?? null;
					}

					if (patch.name !== undefined) {
						existing.name = patch.name;
					}

					if (patch.sortOrder !== undefined) {
						existing.sortOrder = patch.sortOrder;
					}

					updated[mailboxId] = { id: mailboxId };

					await recordUpdate(tx, {
						accountId: effectiveAccountId,
						type: "Mailbox",
						objectId: mailboxId,
						now,
					});
				} catch (err) {
					if (err instanceof MailboxSetProblem) {
						notUpdated[mailboxId] = { type: err.type, description: err.message };
						continue;
					}
					throw err;
				}
			}

			for (const destroyRef of destroyList) {
				try {
					const resolvedId = resolveCreationId(destroyRef, creationResults);
					if (!resolvedId) {
						throw new MailboxSetProblem("invalidArguments", "Invalid mailbox id");
					}

					const existing = mailboxMap.get(resolvedId);
					if (!existing) {
						notDestroyed[destroyRef] = { type: "notFound", description: "Mailbox not found" };
						continue;
					}

					const hasChild = Array.from(mailboxMap.values()).some(
						(mailbox) => mailbox.parentId === resolvedId
					);
					if (hasChild) {
						throw new MailboxSetProblem("mailboxHasChild", "Mailbox has child mailboxes");
					}

					const { hasMessages } = await ensureMailboxEmpty(tx, resolvedId);
					if (hasMessages) {
						throw new MailboxSetProblem("mailboxHasEmail", "Mailbox still contains emails");
					}

					await tx
						.delete(mailboxTable)
						.where(and(eq(mailboxTable.id, resolvedId), eq(mailboxTable.accountId, effectiveAccountId)));

					mailboxMap.delete(resolvedId);
					if (existing.role) {
						roleOwners.delete(existing.role);
					}
					destroyed.push(resolvedId);

					await recordDestroy(tx, {
						accountId: effectiveAccountId,
						type: "Mailbox",
						objectId: resolvedId,
						now,
					});
				} catch (err) {
					if (err instanceof MailboxSetProblem) {
						notDestroyed[destroyRef] = { type: err.type, description: err.message };
						continue;
					}
					throw err;
				}
			}
		});
	} catch (err) {
		console.error("Mailbox/set error", err);
		return ["error", { type: "serverError" }, tag];
	}

	const newState = await getAccountState(db, effectiveAccountId, "Mailbox");

	return [
		"Mailbox/set",
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
