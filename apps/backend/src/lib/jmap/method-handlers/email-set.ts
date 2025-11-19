import { and, eq, inArray } from "drizzle-orm";
import { Context } from "hono";
import type { Attachment as ParsedAttachment, Email as ParsedEmail } from "postal-mime";

import { getDB, TransactionInstance } from "../../../db";
import {
	accountBlobTable,
	accountMessageTable,
	blobTable,
	emailKeywordTable,
	mailboxMessageTable,
	uploadTable,
} from "../../../db/schema";
import {
	buildBodyStructure,
	ensureAccountBlob,
	makeSnippet,
	parseRawEmail,
	parseSentAt,
	resolveOrCreateThreadId,
	storeAddresses,
	storeAttachments,
	storeHeaders,
	upsertCanonicalMessage,
} from "../../mail/ingest";
import {
	recordEmailCreateChanges,
	recordEmailDestroyChanges,
	recordEmailUpdateChanges,
} from "../change-log";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import {
	ensureAccountAccess,
	getAccountMailboxes,
	getAccountState,
	isRecord,
} from "../utils";

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
				notCreated: result.notCreated,
				updated: result.updated,
				notUpdated: result.notUpdated,
				destroyed: result.destroyed,
				notDestroyed: result.notDestroyed,
			},
			tag,
		];
	} catch (err) {
		console.error("Email/set error", err);
		return ["error", { type: "serverError" }, tag];
	}
}

async function applyEmailSet(
	env: JMAPHonoAppEnv["Bindings"],
	db: ReturnType<typeof getDB>,
	args: EmailSetArgs
): Promise<EmailSetResult> {
	const accountId = args.accountId;
	const oldState = await getAccountState(db, accountId, "Email");

	const created: Record<string, unknown> = {};
	const notCreated: Record<string, EmailSetFailure> = {};
	const updated: Record<string, unknown> = {};
	const notUpdated: Record<string, EmailSetFailure> = {};
	const destroyed: string[] = [];
	const notDestroyed: Record<string, EmailSetFailure> = {};

	const now = new Date();
	const mailboxInfo = await getAccountMailboxes(db, accountId);

	const createEntries = Object.entries(args.create ?? {});
	const preparedCreates: PreparedEmailCreate[] = [];

	for (const [creationId, rawCreate] of createEntries) {
		try {
			const prepared = await prepareEmailCreate({
				env,
				db,
				accountId,
				creationId,
				rawCreate,
				mailboxLookup: mailboxInfo.byId,
			});
			preparedCreates.push(prepared);
		} catch (err) {
			if (err instanceof EmailSetProblem) {
				notCreated[creationId] = {
					type: err.jmapType,
					description: err.message,
				};
				continue;
			}
			throw err;
		}
	}

	const updateMap = args.update ?? {};
	const destroyIds = args.destroy ?? [];

	await db.transaction(async (tx) => {
		for (const prepared of preparedCreates) {
			const { accountMessageId } = await persistEmailCreate({
				tx,
				env,
				accountId,
				prepared,
				now,
			});
			created[prepared.creationId] = { id: accountMessageId };
		}

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
				notUpdated[emailId] = { type: "notFound", description: "Email not found" };
				continue;
			}

			let touchedMailboxIds: string[] = [];
			let stateChanged = false;

			if (patch.mailboxIds) {
				let targetMailboxIds: string[];
				try {
					targetMailboxIds = extractMailboxTargets(patch.mailboxIds, mailboxInfo.byId);
				} catch (err) {
					if (err instanceof EmailSetProblem) {
						notUpdated[emailId] = { type: err.jmapType, description: err.message };
						continue;
					}
					throw err;
				}

				if (targetMailboxIds.length === 0) {
					notUpdated[emailId] = {
						type: "invalidProperties",
						description: "mailboxIds must include at least one mailbox",
					};
					continue;
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
					stateChanged = true;
				}

				for (const mailboxId of toInsert) {
					await tx.insert(mailboxMessageTable).values({
						accountMessageId: row.id,
						mailboxId,
						addedAt: now,
					});
					stateChanged = true;
				}

				if (stateChanged) {
					await tx
						.update(accountMessageTable)
						.set({ updatedAt: now })
						.where(eq(accountMessageTable.id, row.id));
				}

				touchedMailboxIds = Array.from(new Set([...toDelete, ...toInsert]));
			}

			if (patch.keywords) {
				const { flags, custom } = splitKeywords(patch.keywords, {
					isSeen: row.isSeen,
					isFlagged: row.isFlagged,
					isAnswered: row.isAnswered,
					isDraft: row.isDraft,
				});

				const flagChanged =
					flags.isSeen !== row.isSeen ||
					flags.isFlagged !== row.isFlagged ||
					flags.isAnswered !== row.isAnswered ||
					flags.isDraft !== row.isDraft;

				if (flagChanged) {
					await tx
						.update(accountMessageTable)
						.set({
							isSeen: flags.isSeen,
							isFlagged: flags.isFlagged,
							isAnswered: flags.isAnswered,
							isDraft: flags.isDraft,
							updatedAt: now,
						})
						.where(eq(accountMessageTable.id, row.id));
					stateChanged = true;
				}

				if (Object.keys(custom).length > 0) {
					await applyCustomKeywordMutations(tx, row.id, custom);
					stateChanged = true;
				}
			}

			if (stateChanged || touchedMailboxIds.length > 0) {
				await recordEmailUpdateChanges({
					tx,
					accountId,
					accountMessageId: row.id,
					threadId: row.threadId,
					mailboxIds: touchedMailboxIds,
					now,
				});
			}

			updated[emailId] = { id: row.id };
		}

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
				notDestroyed[emailId] = { type: "notFound", description: "Email not found" };
				continue;
			}

			const membershipRows = await tx
				.select({ mailboxId: mailboxMessageTable.mailboxId })
				.from(mailboxMessageTable)
				.where(eq(mailboxMessageTable.accountMessageId, row.id));

			const mailboxIds = membershipRows.map((m) => m.mailboxId);

			await tx
				.update(accountMessageTable)
				.set({
					isDeleted: true,
					updatedAt: now,
				})
				.where(eq(accountMessageTable.id, row.id));

			await tx.delete(mailboxMessageTable).where(eq(mailboxMessageTable.accountMessageId, row.id));
			await tx.delete(emailKeywordTable).where(eq(emailKeywordTable.accountMessageId, row.id));

			await recordEmailDestroyChanges({
				tx,
				accountId,
				accountMessageId: row.id,
				threadId: row.threadId,
				mailboxIds,
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
		notCreated,
		updated,
		notUpdated,
		destroyed,
		notDestroyed,
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
	notCreated: Record<string, EmailSetFailure>;
	updated: Record<string, unknown>;
	notUpdated: Record<string, EmailSetFailure>;
	destroyed: string[];
	notDestroyed: Record<string, EmailSetFailure>;
};

type EmailUpdatePatch = {
	mailboxIds?: Record<string, boolean>;
	keywords?: Record<string, boolean>;
};

type EmailSetFailure = {
	type: string;
	description?: string;
};
type PreparedEmailCreate = {
	creationId: string;
	blobId: string;
	mailboxIds: string[];
	email: ParsedEmail;
	snippet: string | null;
	sentAt: Date | null;
	size: number;
	hasAttachment: boolean;
	bodyStructureJson: string | null;
	flags: KeywordFlags;
	customKeywords: Record<string, boolean>;
	uploadTokenId: string;
};

async function prepareEmailCreate(opts: {
	env: JMAPHonoAppEnv["Bindings"];
	db: ReturnType<typeof getDB>;
	accountId: string;
	creationId: string;
	rawCreate: unknown;
	mailboxLookup: Map<string, { id: string; role: string | null }>;
}): Promise<PreparedEmailCreate> {
	const { env, db, accountId, creationId, rawCreate, mailboxLookup } = opts;
	const now = new Date();

	if (!isRecord(rawCreate)) {
		throw new EmailSetProblem("invalidProperties", "Email/create patch must be an object");
	}

	const blobIdValue = rawCreate.blobId;
	if (typeof blobIdValue !== "string" || blobIdValue.length === 0) {
		throw new EmailSetProblem("invalidProperties", "blobId must be a non-empty string");
	}

	const uploadTokenValue = rawCreate.uploadToken;
	if (typeof uploadTokenValue !== "string" || uploadTokenValue.length === 0) {
		throw new EmailSetProblem("invalidProperties", "uploadToken must be provided");
	}

	const mailboxIdsValue = rawCreate.mailboxIds;
	if (!isRecord(mailboxIdsValue)) {
		throw new EmailSetProblem("invalidProperties", "mailboxIds must be provided");
	}

	const mailboxPatch: Record<string, boolean> = {};
	for (const [mailboxId, flag] of Object.entries(mailboxIdsValue)) {
		if (typeof flag === "boolean") {
			mailboxPatch[mailboxId] = flag;
		}
	}

	if (Object.keys(mailboxPatch).length === 0) {
		throw new EmailSetProblem("invalidProperties", "mailboxIds must contain booleans");
	}

	const mailboxIds = extractMailboxTargets(mailboxPatch, mailboxLookup);
	if (mailboxIds.length === 0) {
		throw new EmailSetProblem("invalidProperties", "mailboxIds must include at least one mailbox");
	}

	const keywordPatch = extractKeywordMap(rawCreate.keywords);
	const { flags, custom } = splitKeywords(
		keywordPatch ?? {},
		createDefaultKeywordFlags()
	);

	const [tokenRow] = await db
		.select({
			blobSha256: uploadTable.blobSha256,
			expiresAt: uploadTable.expiresAt,
		})
		.from(uploadTable)
		.where(and(eq(uploadTable.id, uploadTokenValue), eq(uploadTable.accountId, accountId)))
		.limit(1);

	if (!tokenRow) {
		throw new EmailSetProblem("invalidProperties", "uploadToken is invalid or expired");
	}

	if (tokenRow.blobSha256 !== blobIdValue) {
		throw new EmailSetProblem("invalidProperties", "uploadToken does not match blobId");
	}

	if (tokenRow.expiresAt && tokenRow.expiresAt.getTime() <= now.getTime()) {
		await db.delete(uploadTable).where(eq(uploadTable.id, uploadTokenValue));
		throw new EmailSetProblem("invalidProperties", "uploadToken has expired");
	}

	const [blobRow] = await db
		.select({
			sha256: blobTable.sha256,
			size: blobTable.size,
			r2Key: blobTable.r2Key,
		})
		.from(blobTable)
		.innerJoin(
			accountBlobTable,
			and(eq(accountBlobTable.sha256, blobTable.sha256), eq(accountBlobTable.accountId, accountId))
		)
		.where(eq(blobTable.sha256, blobIdValue))
		.limit(1);

	if (!blobRow) {
		throw new EmailSetProblem("invalidProperties", "blobId not found for this account");
	}

	const r2Key = blobRow.r2Key ?? `blob/${blobIdValue}`;
	const obj = await env.R2_EMAILS.get(r2Key);
	if (!obj || !obj.body) {
		throw new EmailSetProblem("invalidProperties", "Blob data is unavailable");
	}

	let rawBuffer: ArrayBuffer;
	try {
		rawBuffer = await obj.arrayBuffer();
	} catch {
		throw new EmailSetProblem("invalidProperties", "Failed to read blob data");
	}

	const email = await parseRawEmail(rawBuffer);
	const snippet = makeSnippet(email);
	const sentAt = parseSentAt(email);
	const size = rawBuffer.byteLength;
	const hasAttachment = (email.attachments?.length ?? 0) > 0;
	const bodyStructureJson = JSON.stringify(buildBodyStructure(email, size));

	return {
		creationId,
		blobId: blobIdValue,
		mailboxIds,
		email,
		snippet,
		sentAt,
		size,
		hasAttachment,
		bodyStructureJson,
		flags,
		customKeywords: custom,
		uploadTokenId: uploadTokenValue,
	};
}

async function persistEmailCreate(opts: {
	tx: TransactionInstance;
	env: JMAPHonoAppEnv["Bindings"];
	accountId: string;
	prepared: PreparedEmailCreate;
	now: Date;
}): Promise<{ accountMessageId: string; threadId: string }> {
	const { tx, env, accountId, prepared, now } = opts;
	const canonicalMessageId = await upsertCanonicalMessage({
		tx,
		ingestId: crypto.randomUUID(),
		rawBlobSha256: prepared.blobId,
		email: prepared.email,
		snippet: prepared.snippet,
		sentAt: prepared.sentAt,
		size: prepared.size,
		hasAttachment: prepared.hasAttachment,
		bodyStructureJson: prepared.bodyStructureJson,
		now,
	});

	await storeHeaders({ tx, canonicalMessageId, email: prepared.email });
	const attachmentBlobShas = await storeAttachments({
		tx,
		env,
		canonicalMessageId,
		attachments: (prepared.email.attachments ?? []) as ParsedAttachment[],
		now,
	});
	await storeAddresses({ tx, canonicalMessageId, email: prepared.email });

	await ensureAccountBlob(tx, accountId, prepared.blobId, now);
	for (const sha of attachmentBlobShas) {
		await ensureAccountBlob(tx, accountId, sha, now);
	}

	const threadId = await resolveOrCreateThreadId({
		tx,
		accountId,
		subject: prepared.email.subject ?? null,
		internalDate: now,
		inReplyTo: prepared.email.inReplyTo ?? null,
		referencesHeader: prepared.email.references ?? null,
	});

	const accountMessageId = crypto.randomUUID();

	await tx.insert(accountMessageTable).values({
		id: accountMessageId,
		accountId,
		messageId: canonicalMessageId,
		threadId,
		internalDate: now,
		isSeen: prepared.flags.isSeen,
		isFlagged: prepared.flags.isFlagged,
		isAnswered: prepared.flags.isAnswered,
		isDraft: prepared.flags.isDraft,
		isDeleted: false,
		createdAt: now,
		updatedAt: now,
	});

	if (prepared.mailboxIds.length > 0) {
		await tx.insert(mailboxMessageTable).values(
			prepared.mailboxIds.map((mailboxId) => ({
				accountMessageId,
				mailboxId,
				addedAt: now,
			}))
		);
	}

	if (Object.keys(prepared.customKeywords).length > 0) {
		await applyCustomKeywordMutations(tx, accountMessageId, prepared.customKeywords);
	}

	await recordEmailCreateChanges({
		tx,
		accountId,
		accountMessageId,
		threadId,
		mailboxIds: prepared.mailboxIds,
		now,
	});

	await tx.delete(uploadTable).where(eq(uploadTable.id, prepared.uploadTokenId));

	return { accountMessageId, threadId };
}

function extractMailboxTargets(
	mailboxPatch: Record<string, boolean>,
	mailboxLookup: Map<string, { id: string; role: string | null }>
): string[] {
	const targets: string[] = [];
	for (const [mailboxId, keep] of Object.entries(mailboxPatch)) {
		if (!mailboxLookup.has(mailboxId)) {
			throw new EmailSetProblem("notFound", `Mailbox ${mailboxId} not found`);
		}
		if (keep) {
			targets.push(mailboxId);
		}
	}
	return Array.from(new Set(targets));
}

function extractKeywordMap(raw: unknown): Record<string, boolean> | undefined {
	if (!isRecord(raw)) return undefined;
	const output: Record<string, boolean> = {};
	for (const [keyword, value] of Object.entries(raw)) {
		if (typeof value === "boolean") {
			output[keyword] = value;
		}
	}
	return Object.keys(output).length > 0 ? output : undefined;
}

type KeywordFlags = {
	isSeen: boolean;
	isFlagged: boolean;
	isAnswered: boolean;
	isDraft: boolean;
};

function createDefaultKeywordFlags(): KeywordFlags {
	return {
		isSeen: false,
		isFlagged: false,
		isAnswered: false,
		isDraft: false,
	};
}

const KEYWORD_FLAG_MAP: Record<string, keyof KeywordFlags> = {
	"$seen": "isSeen",
	"\\seen": "isSeen",
	"$flagged": "isFlagged",
	"\\flagged": "isFlagged",
	"$answered": "isAnswered",
	"\\answered": "isAnswered",
	"$draft": "isDraft",
	"\\draft": "isDraft",
};

function normalizeKeywordName(keyword: string): string {
	if (!keyword) return keyword;
	if (keyword.startsWith("\\")) {
		return `\\${keyword.slice(1).toLowerCase()}`;
	}
	if (keyword.startsWith("$")) {
		return `$${keyword.slice(1).toLowerCase()}`;
	}
	return keyword.toLowerCase();
}

function splitKeywords(
	keywordPatch: Record<string, boolean>,
	baseFlags: KeywordFlags
): { flags: KeywordFlags; custom: Record<string, boolean> } {
	const flags: KeywordFlags = { ...baseFlags };
	const custom: Record<string, boolean> = {};

	for (const [keyword, value] of Object.entries(keywordPatch)) {
		const normalized = normalizeKeywordName(keyword);
		const mapped = KEYWORD_FLAG_MAP[normalized];
		if (mapped) {
			flags[mapped] = value;
		} else {
			custom[normalized] = value;
		}
	}

	return { flags, custom };
}

async function applyCustomKeywordMutations(
	tx: TransactionInstance,
	accountMessageId: string,
	custom: Record<string, boolean>
): Promise<void> {
	const entries = Object.entries(custom);
	if (!entries.length) return;

	for (const [keyword, keep] of entries) {
		const normalized = normalizeKeywordName(keyword);
		if (keep) {
			await tx
				.insert(emailKeywordTable)
				.values({
					accountMessageId,
					keyword: normalized,
				})
				.onConflictDoNothing({
					target: [emailKeywordTable.accountMessageId, emailKeywordTable.keyword],
				});
		} else {
			await tx
				.delete(emailKeywordTable)
				.where(
					and(
						eq(emailKeywordTable.accountMessageId, accountMessageId),
						eq(emailKeywordTable.keyword, normalized)
					)
				);
		}
	}
}

class EmailSetProblem extends Error {
	readonly jmapType: string;

	constructor(type: string, message: string) {
		super(message);
		this.jmapType = type;
	}
}
