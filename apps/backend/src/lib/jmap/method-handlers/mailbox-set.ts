import { and, eq, inArray } from "drizzle-orm";
import { Context } from "hono";

import { getDB, type TransactionInstance } from "../../../db";
import { accountMessageTable, mailboxMessageTable, mailboxTable } from "../../../db/schema";
import { recordCreate, recordDestroy, recordEmailUpdateChanges, recordUpdate } from "../change-log";
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
	sortOrder: number;
};

type MailboxUpdate = {
	name?: string;
	parentId?: string | null;
	sortOrder?: number;
};

class MailboxSetProblem extends Error {
	readonly type: string;

	constructor(type: string, message: string) {
		super(message);
		this.type = type;
	}
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

	if (raw.role !== undefined) {
		throw new MailboxSetProblem("invalidProperties", "role is read-only");
	}

	return {
		name: nameValue.trim(),
		parentId,
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
		throw new MailboxSetProblem("invalidProperties", "role is read-only");
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

async function removeMailboxMemberships(
	tx: TransactionInstance,
	accountId: string,
	mailboxId: string,
	now: Date
): Promise<void> {
	const membershipRows = await tx
		.select({
			accountMessageId: mailboxMessageTable.accountMessageId,
			threadId: accountMessageTable.threadId,
		})
		.from(mailboxMessageTable)
		.innerJoin(
			accountMessageTable,
			and(
				eq(mailboxMessageTable.accountMessageId, accountMessageTable.id),
				eq(accountMessageTable.accountId, accountId),
				eq(accountMessageTable.isDeleted, false)
			)
		)
		.where(eq(mailboxMessageTable.mailboxId, mailboxId));

	if (!membershipRows.length) {
		await tx.delete(mailboxMessageTable).where(eq(mailboxMessageTable.mailboxId, mailboxId));
		return;
	}

	const emailIds = membershipRows.map((row) => row.accountMessageId);

	await tx.delete(mailboxMessageTable).where(eq(mailboxMessageTable.mailboxId, mailboxId));

	await tx
		.update(accountMessageTable)
		.set({ updatedAt: now })
		.where(inArray(accountMessageTable.id, emailIds));

	for (const row of membershipRows) {
		await recordEmailUpdateChanges({
			tx,
			accountId,
			accountMessageId: row.accountMessageId,
			threadId: row.threadId,
			mailboxIds: [mailboxId],
			now,
		});
	}
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
	const ifInState = args.ifInState as string | undefined;
	if (ifInState && ifInState !== oldState) {
		return ["error", { type: "stateMismatch" }, tag];
	}
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

			for (const row of rows) {
				const info: MailboxInfo = {
					id: row.id,
					name: row.name,
					parentId: row.parentId ?? null,
					role: row.role ?? null,
					sortOrder: row.sortOrder ?? 0,
				};
				mailboxMap.set(row.id, info);
			}

			const creationResults = new Map<string, string>();

			for (const [creationId, raw] of Object.entries(createMap)) {
				try {
					const parsed = parseMailboxCreate(raw);
					const resolvedParentId = resolveCreationId(parsed.parentId, creationResults);
					const mailboxId = crypto.randomUUID();

					ensureParentValid(mailboxMap, resolvedParentId, mailboxId);

					await tx.insert(mailboxTable).values({
						id: mailboxId,
						accountId: effectiveAccountId,
						name: parsed.name,
						parentId: resolvedParentId,
						role: null,
						sortOrder: parsed.sortOrder,
						createdAt: now,
						updatedAt: now,
					});

					const info: MailboxInfo = {
						id: mailboxId,
						name: parsed.name,
						parentId: resolvedParentId,
						role: null,
						sortOrder: parsed.sortOrder,
					};
					mailboxMap.set(mailboxId, info);
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
					ensureParentValid(mailboxMap, resolvedParent ?? null, mailboxId);

					await tx
						.update(mailboxTable)
						.set({
							...(patch.name !== undefined ? { name: patch.name } : {}),
							...(patch.parentId !== undefined ? { parentId: resolvedParent } : {}),
							...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
							updatedAt: now,
						})
						.where(and(eq(mailboxTable.id, mailboxId), eq(mailboxTable.accountId, effectiveAccountId)));

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

					await removeMailboxMemberships(tx, effectiveAccountId, resolvedId, now);

					await tx
						.delete(mailboxTable)
						.where(and(eq(mailboxTable.id, resolvedId), eq(mailboxTable.accountId, effectiveAccountId)));

					mailboxMap.delete(resolvedId);
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
