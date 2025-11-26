import { and, eq, inArray, sql } from "drizzle-orm";
import { Context } from "hono";
import type { Email as ParsedEmail } from "postal-mime";

import { getDB, TransactionInstance } from "../../../db";
import {
	accountBlobTable,
	accountMessageTable,
	attachmentTable,
	blobTable,
	emailKeywordTable,
	mailboxMessageTable,
	messageAddressTable,
	messageHeaderTable,
	messageTable,
	threadTable,
} from "../../../db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE, JMAP_MAIL } from "../constants";
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
	upsertBlob,
	upsertCanonicalMessage,
} from "../../mail/ingest";
import type { PreparedAttachmentInput } from "../../mail/ingest";
import {
	recordDestroy,
	recordEmailCreateChanges,
	recordEmailDestroyChanges,
	recordEmailUpdateChanges,
} from "../change-log";
import { JMAPHonoAppEnv } from "../middlewares";
import { CreationReferenceMap, JmapMethodResponse } from "../types";
import {
	ensureAccountAccess,
	getAccountMailboxes,
	getAccountState,
	isRecord,
} from "../utils";
import { sha256HexFromArrayBuffer } from "../../utils";

const draftEncoder = new TextEncoder();
const MAX_MAILBOXES_PER_EMAIL = JMAP_CONSTRAINTS[JMAP_MAIL]?.maxMailboxesPerEmail ?? null;
const MAX_ATTACHMENT_BYTES = JMAP_CONSTRAINTS[JMAP_MAIL]?.maxSizeAttachmentsPerEmail ?? null;

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
	const ifInState = args.ifInState as string | undefined;
	if (ifInState && ifInState !== state) {
		return ["error", { type: "stateMismatch" }, tag];
	}

	const maxSetObjects = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInSet ?? 128;
	const createCount = isRecord(args.create) ? Object.keys(args.create).length : 0;
	const updateCount = isRecord(args.update) ? Object.keys(args.update).length : 0;
	const destroyCount = Array.isArray(args.destroy) ? args.destroy.length : 0;
	if (createCount > maxSetObjects) {
		return [
			"error",
			{
				type: "limitExceeded",
				description: `create exceeds maxObjectsInSet (${maxSetObjects})`,
			},
			tag,
		];
	}
	if (updateCount > maxSetObjects) {
		return [
			"error",
			{
				type: "limitExceeded",
				description: `update exceeds maxObjectsInSet (${maxSetObjects})`,
			},
			tag,
		];
	}
	if (destroyCount > maxSetObjects) {
		return [
			"error",
			{
				type: "limitExceeded",
				description: `destroy exceeds maxObjectsInSet (${maxSetObjects})`,
			},
			tag,
		];
	}

	const input: EmailSetArgs = {
		accountId: effectiveAccountId,
		create: (args.create as Record<string, unknown> | undefined) ?? undefined,
		update: (args.update as Record<string, unknown> | undefined) ?? undefined,
		destroy: (args.destroy as string[] | undefined) ?? undefined,
	};

	const creationRefs = c.get("creationReferences") as CreationReferenceMap | undefined;
	try {
		const result = await applyEmailSet(c.env, db, input, creationRefs);

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

export async function applyEmailSet(
	env: JMAPHonoAppEnv["Bindings"],
	db: ReturnType<typeof getDB>,
	args: EmailSetArgs,
	creationRefs?: CreationReferenceMap
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
	const creationResults = new Map<string, string>();

	for (const [creationId, rawCreate] of createEntries) {
		try {
			const prepared = await prepareEmailCreate({
				env,
				db,
				accountId,
				creationId,
				rawCreate,
				mailboxLookup: mailboxInfo.byId,
				creationRefs,
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
			creationResults.set(prepared.creationId, accountMessageId);
			created[prepared.creationId] = { id: accountMessageId };
		}

		for (const [emailId, rawPatch] of Object.entries(updateMap)) {
			const resolvedEmailId = resolveEmailSetReference(emailId, creationResults);
			if (!resolvedEmailId) {
				notUpdated[emailId] = {
					type: "invalidArguments",
					description: "Unknown creation id reference",
				};
				continue;
			}

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
					and(
						eq(accountMessageTable.id, resolvedEmailId),
						eq(accountMessageTable.accountId, accountId),
						eq(accountMessageTable.isDeleted, false)
					)
				)
				.limit(1);

			if (!row) {
				notUpdated[emailId] = { type: "notFound", description: "Email not found" };
				continue;
			}

			const mailboxUpdateResult = patch.mailboxIds
				? await applyMailboxPatch(tx, row.id, patch.mailboxIds, mailboxInfo.byId, now, creationRefs)
				: { changed: false, touchedMailboxIds: [] };
			const keywordUpdateResult = patch.keywords
				? await applyKeywordPatch(
						tx,
						row.id,
						row.isSeen,
						row.isFlagged,
						row.isAnswered,
						row.isDraft,
						patch.keywords,
						now
				  )
				: { changed: false };

			if (mailboxUpdateResult.changed || keywordUpdateResult.changed) {
				const emailUpdatedProperties: string[] = [];
				if (mailboxUpdateResult.changed) {
					emailUpdatedProperties.push("mailboxIds");
				}
				if (keywordUpdateResult.changed) {
					emailUpdatedProperties.push("keywords");
				}
				await recordEmailUpdateChanges({
					tx,
					accountId,
					accountMessageId: row.id,
					threadId: row.threadId,
					mailboxIds: mailboxUpdateResult.touchedMailboxIds,
					now,
					emailUpdatedProperties,
					threadUpdatedProperties: mailboxUpdateResult.changed ? ["emailIds"] : null,
				});
				updated[emailId] = { id: row.id };
			}
		}

		const destroyTargets: { input: string; id: string }[] = [];
		for (const ref of destroyIds) {
			const resolved = resolveEmailSetReference(ref, creationResults);
			if (!resolved) {
				notDestroyed[ref] = {
					type: "invalidArguments",
					description: "Unknown creation id reference",
				};
				continue;
			}
			destroyTargets.push({ input: ref, id: resolved });
		}

		await handleEmailDestroy(env, tx, accountId, destroyTargets, destroyed, notDestroyed, now);
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

function resolveEmailSetReference(
	id: string,
	creationResults: Map<string, string>
): string | null {
	if (typeof id !== "string" || id.length === 0) {
		return null;
	}
	if (!id.startsWith("#")) {
		return id;
	}
	const resolved = creationResults.get(id.slice(1));
	return resolved ?? null;
}

function resolveMailboxReference(id: string, creationRefs?: CreationReferenceMap): string {
	if (typeof id !== "string" || id.length === 0) {
		throw new EmailSetProblem("invalidProperties", "mailboxIds keys must be non-empty strings");
	}
	if (!id.startsWith("#")) {
		return id;
	}
	const resolved = creationRefs?.get(id.slice(1));
	if (!resolved) {
		throw new EmailSetProblem("invalidArguments", `Unknown mailbox creation id ${id}`);
	}
	return resolved;
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
	attachments: PreparedAttachmentInput[];
	snippet: string | null;
	sentAt: Date | null;
	size: number;
	hasAttachment: boolean;
	bodyStructureJson: string | null;
	flags: KeywordFlags;
	customKeywords: Record<string, boolean>;
	internalDate?: Date | null;
};

async function prepareEmailCreate(opts: {
	env: JMAPHonoAppEnv["Bindings"];
	db: ReturnType<typeof getDB>;
	accountId: string;
	creationId: string;
	rawCreate: unknown;
	mailboxLookup: Map<string, { id: string; role: string | null }>;
	creationRefs?: CreationReferenceMap;
}): Promise<PreparedEmailCreate> {
	const { env, db, accountId, creationId, rawCreate, mailboxLookup, creationRefs } = opts;
	const now = new Date();

	if (!isRecord(rawCreate)) {
		throw new EmailSetProblem("invalidProperties", "Email/create patch must be an object");
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

	const mailboxIds = extractMailboxTargets(mailboxPatch, mailboxLookup, creationRefs);
	enforceMailboxLimit(mailboxIds);
	if (mailboxIds.length === 0) {
		throw new EmailSetProblem("invalidProperties", "mailboxIds must include at least one mailbox");
	}

	const keywordPatch = extractKeywordMap(rawCreate.keywords);
	const { flags, custom } = splitKeywords(
		keywordPatch ?? {},
		createDefaultKeywordFlags()
	);

	const structuredDraft = await maybePrepareStructuredDraft(env, rawCreate, accountId, db);
	if (structuredDraft) {
		return {
			creationId,
			blobId: structuredDraft.blobId,
			mailboxIds,
			email: structuredDraft.email,
			attachments: structuredDraft.attachments,
			snippet: structuredDraft.snippet,
			sentAt: structuredDraft.sentAt,
			size: structuredDraft.size,
			hasAttachment: structuredDraft.hasAttachment,
			bodyStructureJson: structuredDraft.bodyStructureJson,
			flags,
			customKeywords: custom,
			internalDate: now,
		};
	}

	const blobIdValue = rawCreate.blobId;
	if (typeof blobIdValue !== "string" || blobIdValue.length === 0) {
		throw new EmailSetProblem("invalidProperties", "blobId must be a non-empty string");
	}

	const [blobMapping] = await db
		.select({ sha256: accountBlobTable.sha256 })
		.from(accountBlobTable)
		.where(and(eq(accountBlobTable.accountId, accountId), eq(accountBlobTable.sha256, blobIdValue)))
		.limit(1);

	if (!blobMapping) {
		throw new EmailSetProblem("invalidProperties", "blobId not found for this account");
	}

	const parsedBlob = await prepareEmailFromBlob({
		env,
		db,
		accountId,
		blobId: blobIdValue,
	});
	enforceAttachmentAggregateLimit(parsedBlob.attachments.reduce((sum, att) => sum + att.size, 0));

	return {
		creationId,
		blobId: blobIdValue,
		mailboxIds,
		email: parsedBlob.email,
		attachments: parsedBlob.attachments,
		snippet: parsedBlob.snippet,
		sentAt: parsedBlob.sentAt,
		size: parsedBlob.size,
		hasAttachment: parsedBlob.hasAttachment,
		bodyStructureJson: parsedBlob.bodyStructureJson,
		flags,
		customKeywords: custom,
		internalDate: now,
	};
}

type StructuredDraftResult = {
	blobId: string;
	email: ParsedEmail;
	attachments: PreparedAttachmentInput[];
	snippet: string | null;
	sentAt: Date | null;
	size: number;
	hasAttachment: boolean;
	bodyStructureJson: string | null;
};

type DraftAddressInput = {
	email: string;
	name?: string | null;
};

type StructuredDraftInput = {
	subject: string | null;
	from: DraftAddressInput[];
	to: DraftAddressInput[];
	cc: DraftAddressInput[];
	bcc: DraftAddressInput[];
	replyTo: DraftAddressInput[];
	textBody: string | null;
	htmlBody: string | null;
	attachments: DraftAttachmentInput[];
};

type DraftAttachmentInput = {
	blobId: string;
	type?: string | null;
	name?: string | null;
	charset?: string | null;
	disposition?: string | null;
	cid?: string | null;
	isInline?: boolean;
};

async function maybePrepareStructuredDraft(
	env: JMAPHonoAppEnv["Bindings"],
	rawCreate: Record<string, unknown>,
	accountId: string,
	db: ReturnType<typeof getDB>
): Promise<StructuredDraftResult | null> {
	const draft = parseStructuredDraftInput(rawCreate);
	if (!draft) return null;

	const loadedAttachments = await loadDraftAttachments({
		env,
		db,
		accountId,
		attachments: draft.attachments,
	});
	enforceAttachmentAggregateLimit(loadedAttachments.reduce((sum, att) => sum + att.data.byteLength, 0));

	const mime = buildMimeFromDraft(draft, loadedAttachments);
	const rawBytes = draftEncoder.encode(mime);
	const rawBuffer = rawBytes.buffer.slice(
		rawBytes.byteOffset,
		rawBytes.byteOffset + rawBytes.byteLength
	) as ArrayBuffer;
	const blobId = await sha256HexFromArrayBuffer(rawBuffer);
	const key = blobId;

	await env.R2_EMAILS.put(key, rawBytes, {
		httpMetadata: {
			contentType: "message/rfc822",
		},
	});
	await db.insert(blobTable).values({
		sha256: blobId,
		size: rawBytes.byteLength,
		r2Key: key,
		createdAt: new Date(),
	}).onConflictDoNothing();
	await db.insert(accountBlobTable).values({
		accountId,
		sha256: blobId,
		createdAt: new Date(),
	}).onConflictDoNothing();

	const parsed = await parseRawEmail(rawBuffer);
	const email = parsed.email;
	const snippet = makeSnippet(email);
	const sentAt = parseSentAt(email);
	const size = rawBytes.byteLength;
	const { structure, attachments } = await buildBodyStructure(parsed, size);
	const hasAttachment = attachments.length > 0;
	const bodyStructureJson = JSON.stringify(structure);

	return {
		blobId,
		email,
		attachments,
		snippet,
		sentAt,
		size,
		hasAttachment,
		bodyStructureJson,
	};
}

function parseStructuredDraftInput(raw: Record<string, unknown>): StructuredDraftInput | null {
	const hasBody = typeof raw.textBody === "string" || typeof raw.htmlBody === "string";
	const hasDraftFields =
		hasBody ||
		raw.subject !== undefined ||
		raw.from !== undefined ||
		raw.to !== undefined ||
		raw.cc !== undefined ||
		raw.bcc !== undefined ||
		raw.replyTo !== undefined;

	if (!hasDraftFields) {
		return null;
	}

	if (!hasBody) {
		throw new EmailSetProblem(
			"invalidProperties",
			"Either textBody or htmlBody must be provided when creating an Email without blobId"
		);
	}

	const fromList = parseDraftAddressList(raw.from);
	if (!fromList || fromList.length === 0) {
		throw new EmailSetProblem("invalidProperties", "from must include at least one address");
	}

	const toList = parseDraftAddressList(raw.to) ?? [];
	const ccList = parseDraftAddressList(raw.cc) ?? [];
	const bccList = parseDraftAddressList(raw.bcc) ?? [];
	const replyToList = parseDraftAddressList(raw.replyTo) ?? [];
	const attachments = parseDraftAttachmentList(raw.attachments);

	return {
		subject: typeof raw.subject === "string" ? raw.subject : null,
		from: fromList,
		to: toList,
		cc: ccList,
		bcc: bccList,
		replyTo: replyToList,
		textBody: typeof raw.textBody === "string" ? raw.textBody : null,
		htmlBody: typeof raw.htmlBody === "string" ? raw.htmlBody : null,
		attachments,
	};
}

function parseDraftAddressList(value: unknown): DraftAddressInput[] | null {
	if (!Array.isArray(value)) return null;
	const list: DraftAddressInput[] = [];
	for (const entry of value) {
		if (!isRecord(entry)) continue;
		const emailValue = typeof entry.email === "string" ? entry.email.trim() : "";
		if (!emailValue) continue;
		const nameValue =
			entry.name !== undefined && entry.name !== null && typeof entry.name === "string"
				? entry.name
				: null;
		list.push({ email: emailValue, name: nameValue });
	}
	return list.length ? list : null;
}

function parseDraftAttachmentList(value: unknown): DraftAttachmentInput[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) {
		throw new EmailSetProblem("invalidProperties", "attachments must be an array when provided");
	}
	const items: DraftAttachmentInput[] = [];
	for (const entry of value) {
		if (!isRecord(entry)) {
			throw new EmailSetProblem("invalidProperties", "attachments entries must be objects");
		}
		const blobIdValue = entry.blobId;
		if (typeof blobIdValue !== "string" || blobIdValue.length === 0) {
			throw new EmailSetProblem("invalidProperties", "attachments entries must include blobId");
		}
		let typeValue: string | null = null;
		if (entry.type !== undefined && entry.type !== null) {
			if (typeof entry.type !== "string") {
				throw new EmailSetProblem("invalidProperties", "attachments.type must be a string");
			}
			typeValue = entry.type;
		}
		let nameValue: string | null = null;
		if (entry.name !== undefined && entry.name !== null) {
			if (typeof entry.name !== "string") {
				throw new EmailSetProblem("invalidProperties", "attachments.name must be a string");
			}
			nameValue = entry.name;
		}
		let charsetValue: string | null = null;
		if (entry.charset !== undefined && entry.charset !== null) {
			if (typeof entry.charset !== "string") {
				throw new EmailSetProblem("invalidProperties", "attachments.charset must be a string");
			}
			charsetValue = entry.charset;
		}
		let dispositionValue: string | null = null;
		if (entry.disposition !== undefined && entry.disposition !== null) {
			if (typeof entry.disposition !== "string") {
				throw new EmailSetProblem("invalidProperties", "attachments.disposition must be a string");
			}
			dispositionValue = entry.disposition;
		}
		let cidValue: string | null = null;
		if (entry.cid !== undefined && entry.cid !== null) {
			if (typeof entry.cid !== "string") {
				throw new EmailSetProblem("invalidProperties", "attachments.cid must be a string");
			}
			cidValue = entry.cid;
		}
		let isInlineValue: boolean | undefined;
		if (entry.isInline !== undefined) {
			if (typeof entry.isInline !== "boolean") {
				throw new EmailSetProblem("invalidProperties", "attachments.isInline must be a boolean");
			}
			isInlineValue = entry.isInline;
		}

		items.push({
			blobId: blobIdValue,
			type: typeValue,
			name: nameValue,
			charset: charsetValue,
			disposition: dispositionValue,
			cid: cidValue,
			isInline: isInlineValue,
		});
	}
	return items;
}

type LoadedDraftAttachment = {
	blobId: string;
	contentType: string;
	filename: string | null;
	charset: string | null;
	disposition: string;
	cid: string | null;
	data: ArrayBuffer;
};

async function loadDraftAttachments(opts: {
	env: JMAPHonoAppEnv["Bindings"];
	db: ReturnType<typeof getDB>;
	accountId: string;
	attachments: DraftAttachmentInput[];
}): Promise<LoadedDraftAttachment[]> {
	const { env, db, accountId, attachments } = opts;
	if (!attachments.length) return [];

	const blobIds = Array.from(new Set(attachments.map((att) => att.blobId)));
	const rows = await db
		.select({
			sha: blobTable.sha256,
			r2Key: blobTable.r2Key,
			type: accountBlobTable.type,
			name: accountBlobTable.name,
		})
		.from(accountBlobTable)
		.innerJoin(blobTable, eq(accountBlobTable.sha256, blobTable.sha256))
		.where(and(eq(accountBlobTable.accountId, accountId), inArray(accountBlobTable.sha256, blobIds)));

	const blobMap = new Map(rows.map((row) => [row.sha, row]));
	const loaded: LoadedDraftAttachment[] = [];

	for (const attachment of attachments) {
		const meta = blobMap.get(attachment.blobId);
		if (!meta) {
			throw new EmailSetProblem("invalidProperties", `Attachment blobId ${attachment.blobId} not found`);
		}
		const object = await env.R2_EMAILS.get(meta.r2Key ?? attachment.blobId);
		if (!object || !object.body) {
			throw new EmailSetProblem("invalidProperties", `Attachment blobId ${attachment.blobId} has no data`);
		}
		const data = await object.arrayBuffer();
		const contentType =
			sanitizeContentType(attachment.type) ??
			sanitizeContentType(meta.type ?? null) ??
			"application/octet-stream";
		const filename = sanitizeAttachmentName(attachment.name ?? meta.name ?? null);
		const dispositionRaw =
			typeof attachment.disposition === "string" && attachment.disposition.length > 0
				? attachment.disposition
				: undefined;
		const dispositionValue = dispositionRaw ?? (attachment.isInline ? "inline" : "attachment");

		loaded.push({
			blobId: attachment.blobId,
			contentType,
			filename,
			charset: attachment.charset ?? null,
			disposition: dispositionValue,
			cid: attachment.cid ?? null,
			data,
		});
	}

	return loaded;
}

function buildMimeFromDraft(draft: StructuredDraftInput, attachments: LoadedDraftAttachment[]): string {
	const headerLines: string[] = [];
	headerLines.push(`Date: ${new Date().toUTCString()}`);
	headerLines.push(`Message-ID: <${crypto.randomUUID()}@gebna.net>`);
	headerLines.push(`From: ${formatAddressList(draft.from)}`);
	if (draft.replyTo.length > 0) {
		headerLines.push(`Reply-To: ${formatAddressList(draft.replyTo)}`);
	}
	if (draft.to.length > 0) headerLines.push(`To: ${formatAddressList(draft.to)}`);
	if (draft.cc.length > 0) headerLines.push(`Cc: ${formatAddressList(draft.cc)}`);
	if (draft.bcc.length > 0) headerLines.push(`Bcc: ${formatAddressList(draft.bcc)}`);
	const subjectValue = draft.subject ?? "";
	headerLines.push(`Subject: ${sanitizeHeaderValue(subjectValue)}`);
	headerLines.push("MIME-Version: 1.0");

	const textBody = draft.textBody ?? null;
	const htmlBody = draft.htmlBody ?? null;

	if (!attachments.length) {
		if (textBody && htmlBody) {
			const boundary = `boundary_${crypto.randomUUID()}`;
			headerLines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
			const parts: string[] = [];
			parts.push(`--${boundary}`);
			parts.push("Content-Type: text/plain; charset=UTF-8");
			parts.push("Content-Transfer-Encoding: 8bit");
			parts.push("");
			parts.push(normalizeBody(textBody));
			parts.push(`--${boundary}`);
			parts.push("Content-Type: text/html; charset=UTF-8");
			parts.push("Content-Transfer-Encoding: 8bit");
			parts.push("");
			parts.push(normalizeBody(htmlBody));
			parts.push(`--${boundary}--`);
			return `${headerLines.join("\r\n")}\r\n\r\n${parts.join("\r\n")}\r\n`;
		}
		const body = textBody ?? htmlBody ?? "";
		const subtype = htmlBody && !textBody ? "html" : "plain";
		headerLines.push(`Content-Type: text/${subtype}; charset=UTF-8`);
		headerLines.push("Content-Transfer-Encoding: 8bit");
		return `${headerLines.join("\r\n")}\r\n\r\n${normalizeBody(body)}\r\n`;
	}

	const mixedBoundary = `mixed_${crypto.randomUUID()}`;
	headerLines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
	const sections: string[] = [];
	sections.push(`--${mixedBoundary}`);
	sections.push(...renderPrimaryBodyPart(textBody, htmlBody));

	for (const attachment of attachments) {
		sections.push(`--${mixedBoundary}`);
		sections.push(...renderAttachmentPart(attachment));
	}
	sections.push(`--${mixedBoundary}--`);

	return `${headerLines.join("\r\n")}\r\n\r\n${sections.join("\r\n")}\r\n`;
}

function formatAddressList(list: DraftAddressInput[]): string {
	return list.map((addr) => formatSingleAddress(addr)).join(", ");
}

function formatSingleAddress(addr: DraftAddressInput): string {
	const email = addr.email;
	const name = addr.name?.trim();
	if (name && name.length > 0) {
		const sanitized = name.replace(/"/g, '\\"');
		return `"${sanitized}" <${email}>`;
	}
	return email;
}

function sanitizeHeaderValue(value: string): string {
	return value.replace(/\r?\n/g, " ").trim();
}

function normalizeBody(value: string): string {
	return value.replace(/\r?\n/g, "\r\n");
}

function sanitizeContentType(value: string | null | undefined): string | null {
	if (!value) return null;
	const trimmed = value.trim().toLowerCase();
	if (!trimmed) return null;
	if (!/^[0-9a-z!#$&^_.+-]+\/[0-9a-z!#$&^_.+-]+$/.test(trimmed)) {
		return null;
	}
	return trimmed;
}

function sanitizeAttachmentName(value: string | null): string | null {
	if (!value) return null;
	const cleaned = value.replace(/\r|\n/g, "").trim();
	return cleaned.length ? cleaned : null;
}

function enforceMailboxLimit(mailboxIds: string[]): void {
	if (
		MAX_MAILBOXES_PER_EMAIL !== null &&
		typeof MAX_MAILBOXES_PER_EMAIL === "number" &&
		mailboxIds.length > MAX_MAILBOXES_PER_EMAIL
	) {
		throw new EmailSetProblem(
			"limitExceeded",
			`mailboxIds exceeds maxMailboxesPerEmail (${MAX_MAILBOXES_PER_EMAIL})`
		);
	}
}

function enforceAttachmentAggregateLimit(totalBytes: number): void {
	if (
		MAX_ATTACHMENT_BYTES !== null &&
		typeof MAX_ATTACHMENT_BYTES === "number" &&
		totalBytes > MAX_ATTACHMENT_BYTES
	) {
		throw new EmailSetProblem(
			"limitExceeded",
			`attachments exceed maxSizeAttachmentsPerEmail (${MAX_ATTACHMENT_BYTES})`
		);
	}
}

function escapeHeaderParameter(value: string): string {
	return value.replace(/(["\\])/g, "\\$1");
}

function encodeBase64Buffer(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		const slice = bytes.subarray(i, i + chunk);
		binary += String.fromCharCode(...slice);
	}
	return btoa(binary);
}

function wrapBase64(value: string, lineLength = 76): string {
	const parts: string[] = [];
	for (let i = 0; i < value.length; i += lineLength) {
		parts.push(value.slice(i, i + lineLength));
	}
	return parts.join("\r\n");
}

function renderPrimaryBodyPart(textBody: string | null, htmlBody: string | null): string[] {
	if (textBody && htmlBody) {
		const boundary = `alt_${crypto.randomUUID()}`;
		const lines: string[] = [];
		lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
		lines.push("");
		lines.push(`--${boundary}`);
		lines.push("Content-Type: text/plain; charset=UTF-8");
		lines.push("Content-Transfer-Encoding: 8bit");
		lines.push("");
		lines.push(normalizeBody(textBody));
		lines.push("");
		lines.push(`--${boundary}`);
		lines.push("Content-Type: text/html; charset=UTF-8");
		lines.push("Content-Transfer-Encoding: 8bit");
		lines.push("");
		lines.push(normalizeBody(htmlBody));
		lines.push("");
		lines.push(`--${boundary}--`);
		lines.push("");
		return lines;
	}
	const body = textBody ?? htmlBody ?? "";
	const subtype = htmlBody && !textBody ? "html" : "plain";
	return [
		`Content-Type: text/${subtype}; charset=UTF-8`,
		"Content-Transfer-Encoding: 8bit",
		"",
		normalizeBody(body),
		"",
	];
}

function renderAttachmentPart(attachment: LoadedDraftAttachment): string[] {
	const lines: string[] = [];
	const params: string[] = [];
	if (attachment.filename) {
		params.push(`name="${escapeHeaderParameter(attachment.filename)}"`);
	}
	if (attachment.charset) {
		params.push(`charset=${attachment.charset}`);
	}
	const contentTypeLine =
		params.length > 0
			? `Content-Type: ${attachment.contentType}; ${params.join("; ")}`
			: `Content-Type: ${attachment.contentType}`;
	lines.push(contentTypeLine);

	let dispositionLine = `Content-Disposition: ${attachment.disposition}`;
	if (attachment.filename) {
		dispositionLine += `; filename="${escapeHeaderParameter(attachment.filename)}"`;
	}
	lines.push(dispositionLine);
	lines.push("Content-Transfer-Encoding: base64");
	if (attachment.cid) {
		lines.push(`Content-ID: <${attachment.cid}>`);
	}
	lines.push("");
	const base64 = encodeBase64Buffer(attachment.data);
	lines.push(wrapBase64(base64));
	lines.push("");
	return lines;
}

async function prepareEmailFromBlob(opts: {
	env: JMAPHonoAppEnv["Bindings"];
	db: ReturnType<typeof getDB>;
	accountId: string;
	blobId: string;
}): Promise<StructuredDraftResult> {
	const { env, db, accountId, blobId } = opts;
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
		.where(eq(blobTable.sha256, blobId))
		.limit(1);

	if (!blobRow) {
		throw new EmailSetProblem("invalidProperties", "blobId not found for this account");
	}

	const r2Key = blobRow.r2Key ?? blobId;
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

	const parsed = await parseRawEmail(rawBuffer);
	const email = parsed.email;
	const snippet = makeSnippet(email);
	const sentAt = parseSentAt(email);
	const size = rawBuffer.byteLength;
	const { structure, attachments } = await buildBodyStructure(parsed, size);
	const hasAttachment = attachments.length > 0;
	const bodyStructureJson = JSON.stringify(structure);

	return {
		blobId,
		email,
		attachments,
		snippet,
		sentAt,
		size,
		hasAttachment,
		bodyStructureJson,
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
	await upsertBlob(tx, prepared.blobId, prepared.size, now);
	const internalDate = prepared.internalDate ?? now;
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
		attachments: prepared.attachments,
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
	internalDate,
	inReplyTo: prepared.email.inReplyTo ?? null,
	referencesHeader: prepared.email.references ?? null,
});

const accountMessageId = crypto.randomUUID();

await tx.insert(accountMessageTable).values({
	id: accountMessageId,
	accountId,
	messageId: canonicalMessageId,
	threadId,
	internalDate,
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

	return { accountMessageId, threadId };
}

function extractMailboxTargets(
	mailboxPatch: Record<string, boolean>,
	mailboxLookup: Map<string, { id: string; role: string | null }>,
	creationRefs?: CreationReferenceMap
): string[] {
	const targets: string[] = [];
	for (const [mailboxId, keep] of Object.entries(mailboxPatch)) {
		const resolvedMailboxId = resolveMailboxReference(mailboxId, creationRefs);
		if (!mailboxLookup.has(resolvedMailboxId)) {
			throw new EmailSetProblem("notFound", `Mailbox ${resolvedMailboxId} not found`);
		}
		if (keep) {
			targets.push(resolvedMailboxId);
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

function isValidKeywordName(keyword: string): boolean {
	if (!keyword || keyword.length > 255) {
		return false;
	}
	for (let i = 0; i < keyword.length; i++) {
		const code = keyword.charCodeAt(i);
		if (code < 0x21 || code > 0x7e) {
			return false;
		}
	}
	return true;
}

function splitKeywords(
	keywordPatch: Record<string, boolean>,
	baseFlags: KeywordFlags
): { flags: KeywordFlags; custom: Record<string, boolean> } {
	const flags: KeywordFlags = { ...baseFlags };
	const custom: Record<string, boolean> = {};

	for (const [keyword, value] of Object.entries(keywordPatch)) {
		const normalized = normalizeKeywordName(keyword);
		if (!isValidKeywordName(normalized)) {
			throw new EmailSetProblem("invalidProperties", `Invalid keyword name: ${keyword}`);
		}
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
async function handleEmailDestroy(
	env: JMAPHonoAppEnv["Bindings"],
	tx: TransactionInstance,
	accountId: string,
	destroyTargets: { input: string; id: string }[],
	destroyed: string[],
	notDestroyed: Record<string, EmailSetFailure>,
	now: Date
): Promise<void> {
	for (const target of destroyTargets) {
		const emailId = target.id;
		const [row] = await tx
			.select({
				id: accountMessageTable.id,
				messageId: accountMessageTable.messageId,
				threadId: accountMessageTable.threadId,
			})
			.from(accountMessageTable)
			.where(
				and(
					eq(accountMessageTable.id, emailId),
					eq(accountMessageTable.accountId, accountId),
					eq(accountMessageTable.isDeleted, false)
				)
			)
			.limit(1);

		if (!row) {
			notDestroyed[target.input] = { type: "notFound", description: "Email not found" };
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

		const [threadRemaining] = await tx
			.select({ count: sql<number>`count(*) as count` })
			.from(accountMessageTable)
			.where(
				and(
					eq(accountMessageTable.accountId, accountId),
					eq(accountMessageTable.threadId, row.threadId),
					eq(accountMessageTable.isDeleted, false)
				)
			);
		const threadStillExists = (threadRemaining?.count ?? 0) > 0;

		await recordEmailDestroyChanges({
			tx,
			accountId,
			accountMessageId: row.id,
			threadId: row.threadId,
			mailboxIds,
			now,
			threadStillExists,
			threadUpdatedProperties: ["emailIds"],
		});

		if (!threadStillExists) {
			await tx
				.delete(threadTable)
				.where(and(eq(threadTable.id, row.threadId), eq(threadTable.accountId, accountId)));
			await recordDestroy(tx, {
				accountId,
				type: "Thread",
				objectId: row.threadId,
				now,
			});
		}

		destroyed.push(emailId);

		await cleanupCanonicalMessageIfUnused({
			tx,
			env,
			canonicalMessageId: row.messageId,
		});
	}
}

async function cleanupCanonicalMessageIfUnused(opts: {
	tx: TransactionInstance;
	env: JMAPHonoAppEnv["Bindings"];
	canonicalMessageId: string;
}): Promise<void> {
	const { tx, env, canonicalMessageId } = opts;
	const [remaining] = await tx
		.select({ count: sql<number>`count(*) as count` })
		.from(accountMessageTable)
		.where(
			and(eq(accountMessageTable.messageId, canonicalMessageId), eq(accountMessageTable.isDeleted, false))
		);

	if ((remaining?.count ?? 0) > 0) {
		return;
	}

	const [messageRow] = await tx
		.select({
			id: messageTable.id,
			rawBlobSha256: messageTable.rawBlobSha256,
		})
		.from(messageTable)
		.where(eq(messageTable.id, canonicalMessageId))
		.limit(1);

	const attachmentRows = await tx
		.select({ blobSha256: attachmentTable.blobSha256 })
		.from(attachmentTable)
		.where(eq(attachmentTable.messageId, canonicalMessageId));

	const blobIds = new Set<string>();
	if (messageRow?.rawBlobSha256) {
		blobIds.add(messageRow.rawBlobSha256);
	}
	for (const attachment of attachmentRows) {
		if (attachment.blobSha256) {
			blobIds.add(attachment.blobSha256);
		}
	}

	const ownerRows = await tx
		.select({ accountId: accountMessageTable.accountId })
		.from(accountMessageTable)
		.where(eq(accountMessageTable.messageId, canonicalMessageId));

	if (ownerRows.length > 0 && blobIds.size > 0) {
		await tx
			.delete(accountBlobTable)
			.where(
				and(
					inArray(
						accountBlobTable.accountId,
						ownerRows.map((row) => row.accountId)
					),
					inArray(accountBlobTable.sha256, Array.from(blobIds))
				)
			);
	}

	await tx.delete(accountMessageTable).where(eq(accountMessageTable.messageId, canonicalMessageId));
	await tx.delete(messageAddressTable).where(eq(messageAddressTable.messageId, canonicalMessageId));
	await tx.delete(messageHeaderTable).where(eq(messageHeaderTable.messageId, canonicalMessageId));
	await tx.delete(attachmentTable).where(eq(attachmentTable.messageId, canonicalMessageId));
	await tx.delete(messageTable).where(eq(messageTable.id, canonicalMessageId));

	await cleanupBlobStorage(env, tx, Array.from(blobIds));
}

async function cleanupBlobStorage(
	env: JMAPHonoAppEnv["Bindings"],
	tx: TransactionInstance,
	blobIds: string[]
): Promise<void> {
	if (!blobIds.length) return;

	const keysToDelete: string[] = [];

	for (const blobId of blobIds) {
		const [rawCount] = await tx
			.select({ count: sql<number>`count(*) as count` })
			.from(messageTable)
			.where(eq(messageTable.rawBlobSha256, blobId));
		if ((rawCount?.count ?? 0) > 0) {
			continue;
		}

		const [attachmentCount] = await tx
			.select({ count: sql<number>`count(*) as count` })
			.from(attachmentTable)
			.where(eq(attachmentTable.blobSha256, blobId));
		if ((attachmentCount?.count ?? 0) > 0) {
			continue;
		}

		const [blobRow] = await tx
			.select({ sha: blobTable.sha256, r2Key: blobTable.r2Key })
			.from(blobTable)
			.where(eq(blobTable.sha256, blobId))
			.limit(1);

		if (!blobRow) {
			continue;
		}

		await tx.delete(blobTable).where(eq(blobTable.sha256, blobId));
		keysToDelete.push(blobRow.r2Key ?? blobId);
	}

	if (!keysToDelete.length) {
		return;
	}

	await Promise.all(
		keysToDelete.map(async (key) => {
			try {
				await env.R2_EMAILS.delete(key);
			} catch (err) {
				console.error("Failed to delete blob from R2", { key, err });
			}
		})
	);
}
async function applyMailboxPatch(
	tx: TransactionInstance,
	accountMessageId: string,
	mailboxPatch: Record<string, boolean>,
	mailboxLookup: Map<string, { id: string; role: string | null }>,
	now: Date,
	creationRefs?: CreationReferenceMap
): Promise<{ changed: boolean; touchedMailboxIds: string[] }> {
	const existingRows = await tx
		.select({
			mailboxId: mailboxMessageTable.mailboxId,
		})
		.from(mailboxMessageTable)
		.where(eq(mailboxMessageTable.accountMessageId, accountMessageId));

	const existingSet = new Set(existingRows.map((r) => r.mailboxId));
	const targetSet = new Set(existingSet);
	const touched = new Set<string>();

	for (const [mailboxId, keep] of Object.entries(mailboxPatch)) {
		if (typeof keep !== "boolean") continue;
		const resolvedMailboxId = resolveMailboxReference(mailboxId, creationRefs);
		if (keep) {
			if (!mailboxLookup.has(resolvedMailboxId)) {
				throw new EmailSetProblem("notFound", `Mailbox ${resolvedMailboxId} not found`);
			}
			if (!targetSet.has(resolvedMailboxId)) {
				targetSet.add(resolvedMailboxId);
				touched.add(resolvedMailboxId);
			}
		} else if (targetSet.has(resolvedMailboxId)) {
			targetSet.delete(resolvedMailboxId);
			touched.add(resolvedMailboxId);
		}
	}

	if (!targetSet.size) {
		throw new EmailSetProblem("invalidProperties", "Email must remain in at least one mailbox");
	}

	const finalMailboxes = Array.from(targetSet);
	enforceMailboxLimit(finalMailboxes);

	const toDelete = existingRows.filter((r) => !targetSet.has(r.mailboxId)).map((r) => r.mailboxId);
	const toInsert = finalMailboxes.filter((mailboxId) => !existingSet.has(mailboxId));

	let changed = false;

	if (toDelete.length > 0) {
		await tx
			.delete(mailboxMessageTable)
			.where(
				and(
					eq(mailboxMessageTable.accountMessageId, accountMessageId),
					inArray(mailboxMessageTable.mailboxId, toDelete)
				)
			);
		changed = true;
	}

	for (const mailboxId of toInsert) {
		await tx.insert(mailboxMessageTable).values({
			accountMessageId,
			mailboxId,
			addedAt: now,
		});
		changed = true;
	}

	if (changed) {
		await tx
			.update(accountMessageTable)
			.set({ updatedAt: now })
			.where(eq(accountMessageTable.id, accountMessageId));
	}

	return { changed, touchedMailboxIds: Array.from(new Set([...touched, ...toDelete, ...toInsert])) };
}

async function applyKeywordPatch(
	tx: TransactionInstance,
	accountMessageId: string,
	currentSeen: boolean,
	currentFlagged: boolean,
	currentAnswered: boolean,
	currentDraft: boolean,
	keywordPatch: Record<string, boolean>,
	now: Date
): Promise<{ changed: boolean }> {
	const { flags, custom } = splitKeywords(keywordPatch, {
		isSeen: currentSeen,
		isFlagged: currentFlagged,
		isAnswered: currentAnswered,
		isDraft: currentDraft,
	});

	let changed = false;
	const flagChanged =
		flags.isSeen !== currentSeen ||
		flags.isFlagged !== currentFlagged ||
		flags.isAnswered !== currentAnswered ||
		flags.isDraft !== currentDraft;

	if (flagChanged || Object.keys(custom).length > 0) {
		await tx
			.update(accountMessageTable)
			.set({
				isSeen: flags.isSeen,
				isFlagged: flags.isFlagged,
				isAnswered: flags.isAnswered,
				isDraft: flags.isDraft,
				updatedAt: now,
			})
			.where(eq(accountMessageTable.id, accountMessageId));
		changed = true;
	}

	if (Object.keys(custom).length > 0) {
		await applyCustomKeywordMutations(tx, accountMessageId, custom);
		changed = true;
	}

	return { changed };
}
