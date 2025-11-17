import { and, eq, inArray, sql } from "drizzle-orm";
import { Context } from "hono";

import { getDB, TransactionInstance } from "../../../db";
import {
	accountMessageTable,
	changeLogTable,
	jmapStateTable,
	mailboxMessageTable,
} from "../../../db/schema";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse, JmapStateType } from "../types";
import { ensureAccountAccess, getAccountState, isRecord } from "../utils";

export async function handleEmailSet(
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

	const state = await getAccountState(db, effectiveAccountId, "Email");

	const input: EmailSetArgs = {
		accountId: effectiveAccountId,
		create: (args.create as Record<string, unknown> | undefined) ?? undefined,
		update: (args.update as Record<string, unknown> | undefined) ?? undefined,
		destroy: (args.destroy as string[] | undefined) ?? undefined,
	};

	try {
		const result = await applyEmailSet(c.env, db, input);

		return [
			"Email/set",
			{
				accountId: result.accountId,
				oldState: result.oldState ?? state,
				newState: result.newState ?? state,
				created: result.created,
				updated: result.updated,
				destroyed: result.destroyed,
			},
			tag,
		];
	} catch (err) {
		console.error("Email/set error", err);
		return ["error", { type: "serverError" }, tag];
	}
}

async function applyEmailSet(
	_env: JMAPHonoAppEnv["Bindings"],
	db: ReturnType<typeof getDB>,
	args: EmailSetArgs
): Promise<EmailSetResult> {
	const accountId = args.accountId;

	// For now we only support update/destroy. Create will come later with composition.
	if (args.create && Object.keys(args.create).length > 0) {
		throw new Error("Email/create is not implemented yet");
	}

	const oldState = await getAccountState(db, accountId, "Email");

	const created: Record<string, unknown> = {};
	const updated: Record<string, unknown> = {};
	const destroyed: string[] = [];

	const updateMap = args.update ?? {};
	const destroyIds = args.destroy ?? [];

	const now = new Date();

	await db.transaction(async (tx) => {
		// ───────────────────────────────────────────────────────────
		// Updates (mailboxIds, keywords -> flags)
		// ───────────────────────────────────────────────────────────
		for (const [emailId, rawPatch] of Object.entries(updateMap)) {
			const patch = parseEmailUpdatePatch(rawPatch);

			if (!patch.mailboxIds && !patch.keywords) {
				continue;
			}

			const [row] = await tx
				.select({
					id: accountMessageTable.id,
					threadId: accountMessageTable.threadId,
					isSeen: accountMessageTable.isSeen,
					isFlagged: accountMessageTable.isFlagged,
					isAnswered: accountMessageTable.isAnswered,
					isDraft: accountMessageTable.isDraft,
				})
				.from(accountMessageTable)
				.where(
					and(eq(accountMessageTable.id, emailId), eq(accountMessageTable.accountId, accountId))
				)
				.limit(1);

			if (!row) {
				// For now we silently skip unknown ids; later you can add notUpdated if you want.
				continue;
			}

			let touchedMailboxIds: string[] = [];

			if (patch.mailboxIds) {
				const targetMailboxIds = Object.entries(patch.mailboxIds)
					.filter(([, keep]) => keep)
					.map(([mailboxId]) => mailboxId);

				if (targetMailboxIds.length === 0) {
					throw new Error("Email/set: mailboxIds must not be empty when provided");
				}

				const existingRows = await tx
					.select({
						mailboxId: mailboxMessageTable.mailboxId,
					})
					.from(mailboxMessageTable)
					.where(eq(mailboxMessageTable.accountMessageId, row.id));

				const existingSet = new Set(existingRows.map((r) => r.mailboxId));
				const targetSet = new Set(targetMailboxIds);

				const toDelete = existingRows
					.filter((r) => !targetSet.has(r.mailboxId))
					.map((r) => r.mailboxId);

				const toInsert = targetMailboxIds.filter((mailboxId) => !existingSet.has(mailboxId));

				if (toDelete.length > 0) {
					await tx
						.delete(mailboxMessageTable)
						.where(
							and(
								eq(mailboxMessageTable.accountMessageId, row.id),
								inArray(mailboxMessageTable.mailboxId, toDelete)
							)
						);
				}

				for (const mailboxId of toInsert) {
					await tx.insert(mailboxMessageTable).values({
						accountMessageId: row.id,
						mailboxId,
						addedAt: now,
					});
				}

				touchedMailboxIds = Array.from(new Set([...toDelete, ...toInsert]));
			}

			let isSeen = row.isSeen;
			let isFlagged = row.isFlagged;
			let isAnswered = row.isAnswered;
			let isDraft = row.isDraft;

			if (patch.keywords) {
				const kw = patch.keywords;

				const seenValue = kw["$seen"] ?? kw["\\Seen"];
				if (seenValue !== undefined) {
					isSeen = seenValue;
				}

				const flaggedValue = kw["$flagged"] ?? kw["\\Flagged"];
				if (flaggedValue !== undefined) {
					isFlagged = flaggedValue;
				}

				const answeredValue = kw["$answered"] ?? kw["\\Answered"];
				if (answeredValue !== undefined) {
					isAnswered = answeredValue;
				}

				const draftValue = kw["$draft"] ?? kw["\\Draft"];
				if (draftValue !== undefined) {
					isDraft = draftValue;
				}

				await tx
					.update(accountMessageTable)
					.set({
						isSeen,
						isFlagged,
						isAnswered,
						isDraft,
						updatedAt: now,
					})
					.where(eq(accountMessageTable.id, row.id));
			}

			if (touchedMailboxIds.length > 0 || patch.keywords) {
				await recordEmailSetChanges({
					tx,
					accountId,
					accountMessageId: row.id,
					threadId: row.threadId,
					mailboxIds: touchedMailboxIds,
					now,
				});
			}

			// Minimal response object for this id; can be extended with more properties later.
			updated[emailId] = { id: row.id };
		}

		// ───────────────────────────────────────────────────────────
		// Destroy (soft-delete for now)
		// ───────────────────────────────────────────────────────────
		for (const emailId of destroyIds) {
			const [row] = await tx
				.select({
					id: accountMessageTable.id,
					threadId: accountMessageTable.threadId,
				})
				.from(accountMessageTable)
				.where(
					and(eq(accountMessageTable.id, emailId), eq(accountMessageTable.accountId, accountId))
				)
				.limit(1);

			if (!row) {
				continue;
			}

			await tx
				.update(accountMessageTable)
				.set({
					isDeleted: true,
					updatedAt: now,
				})
				.where(eq(accountMessageTable.id, row.id));

			// Optionally clear mailbox membership as part of delete
			await tx.delete(mailboxMessageTable).where(eq(mailboxMessageTable.accountMessageId, row.id));

			await recordEmailSetChanges({
				tx,
				accountId,
				accountMessageId: row.id,
				threadId: row.threadId,
				mailboxIds: [],
				now,
			});

			destroyed.push(emailId);
		}
	});

	const newState = await getAccountState(db, accountId, "Email");

	return {
		accountId,
		oldState,
		newState,
		created,
		updated,
		destroyed,
	};
}

function parseEmailUpdatePatch(raw: unknown): EmailUpdatePatch {
	if (!isRecord(raw)) {
		throw new Error("Email/set update patch must be an object");
	}

	const patch: EmailUpdatePatch = {};

	const mailboxIdsValue = raw.mailboxIds;
	if (isRecord(mailboxIdsValue)) {
		const mailboxIds: Record<string, boolean> = {};
		for (const [mailboxId, flag] of Object.entries(mailboxIdsValue)) {
			if (typeof flag === "boolean") {
				mailboxIds[mailboxId] = flag;
			}
		}
		if (Object.keys(mailboxIds).length > 0) {
			patch.mailboxIds = mailboxIds;
		}
	}

	const keywordsValue = raw.keywords;
	if (isRecord(keywordsValue)) {
		const keywords: Record<string, boolean> = {};
		for (const [keyword, flag] of Object.entries(keywordsValue)) {
			if (typeof flag === "boolean") {
				keywords[keyword] = flag;
			}
		}
		if (Object.keys(keywords).length > 0) {
			patch.keywords = keywords;
		}
	}

	return patch;
}

async function bumpStateTx(
	tx: TransactionInstance,
	accountId: string,
	type: JmapStateType
): Promise<number> {
	const [row] = await tx
		.insert(jmapStateTable)
		.values({
			accountId,
			type,
			modSeq: 1,
		})
		.onConflictDoUpdate({
			target: [jmapStateTable.accountId, jmapStateTable.type],
			set: { modSeq: sql`${jmapStateTable.modSeq} + 1` },
		})
		.returning({ modSeq: jmapStateTable.modSeq });

	return row.modSeq;
}

async function recordEmailSetChanges(opts: {
	tx: TransactionInstance;
	accountId: string;
	accountMessageId: string;
	threadId: string;
	mailboxIds: string[];
	now: Date;
}): Promise<void> {
	const { tx, accountId, accountMessageId, threadId, mailboxIds, now } = opts;

	const emailModSeq = await bumpStateTx(tx, accountId, "Email");
	await tx.insert(changeLogTable).values({
		id: crypto.randomUUID(),
		accountId,
		type: "Email",
		objectId: accountMessageId,
		modSeq: emailModSeq,
		createdAt: now,
	});

	const threadModSeq = await bumpStateTx(tx, accountId, "Thread");
	await tx.insert(changeLogTable).values({
		id: crypto.randomUUID(),
		accountId,
		type: "Thread",
		objectId: threadId,
		modSeq: threadModSeq,
		createdAt: now,
	});

	if (mailboxIds.length > 0) {
		const mailboxModSeq = await bumpStateTx(tx, accountId, "Mailbox");
		for (const mailboxId of mailboxIds) {
			await tx.insert(changeLogTable).values({
				id: crypto.randomUUID(),
				accountId,
				type: "Mailbox",
				objectId: mailboxId,
				modSeq: mailboxModSeq,
				createdAt: now,
			});
		}
	}
}

type EmailSetArgs = {
	accountId: string;
	create?: Record<string, unknown>;
	update?: Record<string, unknown>;
	destroy?: string[];
};

type EmailSetResult = {
	accountId: string;
	oldState: string;
	newState: string;
	created: Record<string, unknown>;
	updated: Record<string, unknown>;
	destroyed: string[];
};

type EmailUpdatePatch = {
	mailboxIds?: Record<string, boolean>;
	keywords?: Record<string, boolean>;
};
