import { and, eq } from "drizzle-orm";
import { Context } from "hono";
import type { Email as ParsedEmail } from "postal-mime";

import { getDB, TransactionInstance } from "../../../db";
import {
	accountBlobTable,
	accountMessageTable,
	blobTable,
	emailKeywordTable,
	mailboxMessageTable,
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
	upsertBlob,
	upsertCanonicalMessage,
} from "../../mail/ingest";
import type { PreparedAttachmentInput } from "../../mail/ingest";
import { recordEmailCreateChanges } from "../change-log";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountMailboxes, getAccountState, isRecord } from "../utils";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";

type EmailImportArgs = {
	accountId: string;
	create?: Record<string, unknown>;
};

type EmailImportResult = {
	accountId: string;
	oldState: string;
	newState: string;
	created: Record<string, unknown>;
	notCreated: Record<string, { type: string; description?: string }>;
};

type ImportKeywordFlags = {
	isSeen: boolean;
	isFlagged: boolean;
	isAnswered: boolean;
	isDraft: boolean;
};

type ParsedEmailMetadata = {
	email: ParsedEmail;
	attachments: PreparedAttachmentInput[];
	snippet: string | null;
	sentAt: Date | null;
	size: number;
	hasAttachment: boolean;
	bodyStructureJson: string | null;
};

const KEYWORD_FLAG_MAP: Record<string, keyof ImportKeywordFlags> = {
	$seen: "isSeen",
	"\\seen": "isSeen",
	$flagged: "isFlagged",
	"\\flagged": "isFlagged",
	$answered: "isAnswered",
	"\\answered": "isAnswered",
	$draft: "isDraft",
	"\\draft": "isDraft",
};

export async function handleEmailImport(
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
	const maxSetObjects = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInSet ?? 128;
	const createCount = isRecord(args.emails) ? Object.keys(args.emails).length : 0;
	if (createCount > maxSetObjects) {
		return [
			"error",
			{
				type: "limitExceeded",
				description: `emails exceeds maxObjectsInSet (${maxSetObjects})`,
			},
			tag,
		];
	}

	const input: EmailImportArgs = {
		accountId: effectiveAccountId,
		create: (args.emails as Record<string, unknown> | undefined) ?? undefined,
	};

	const result = await applyEmailImport(c.env, db, input);

	return [
		"Email/import",
		{
			accountId: result.accountId,
			oldState: state,
			newState: result.newState,
			created: result.created,
			notCreated: result.notCreated,
		},
		tag,
	];
}

async function applyEmailImport(
	env: JMAPHonoAppEnv["Bindings"],
	db: ReturnType<typeof getDB>,
	args: EmailImportArgs
): Promise<EmailImportResult> {
	const accountId = args.accountId;
	const createMap = args.create ?? {};

	const created: Record<string, unknown> = {};
	const notCreated: Record<string, { type: string; description?: string }> = {};

	const oldState = await getAccountState(db, accountId, "Email");
	const mailboxInfo = await getAccountMailboxes(db, accountId);

	await db.transaction(async (tx) => {
		for (const [creationId, raw] of Object.entries(createMap)) {
			try {
				const parsed = parseEmailImportCreate(raw, mailboxInfo.byId);
				const metadata = await loadEmailMetadataFromBlob(env, db, accountId, parsed.blobId);
				const { accountMessageId } = await persistImportedEmail({
					tx,
					env,
					accountId,
					mailboxIds: parsed.mailboxIds,
					blobId: parsed.blobId,
					metadata,
					keywords: parsed.keywords,
				});
				created[creationId] = { id: accountMessageId };
			} catch (err) {
				if (err instanceof EmailImportProblem) {
					notCreated[creationId] = { type: err.type, description: err.message };
				} else {
					throw err;
				}
			}
		}
	});

	const newState = await getAccountState(db, accountId, "Email");

	return {
		accountId,
		oldState,
		newState,
		created,
		notCreated,
	};
}

type EmailImportCreate = {
	blobId: string;
	mailboxIds: string[];
	keywords: Record<string, boolean>;
};

function parseEmailImportCreate(
	raw: unknown,
	mailboxLookup: Map<string, { id: string; role: string | null }>
): EmailImportCreate {
	if (!isRecord(raw)) {
		throw new EmailImportProblem("invalidProperties", "Import entry must be an object");
	}

	const blobId = raw.blobId;
	if (typeof blobId !== "string" || !blobId) {
		throw new EmailImportProblem("invalidProperties", "blobId must be a string");
	}

	const mailboxIdsValue = raw.mailboxIds;
	if (!isRecord(mailboxIdsValue)) {
		throw new EmailImportProblem("invalidProperties", "mailboxIds must be provided");
	}

	const targetMailboxIds: string[] = [];
	for (const [mailboxId, keep] of Object.entries(mailboxIdsValue)) {
		if (keep !== true) continue;
		if (!mailboxLookup.has(mailboxId)) {
			throw new EmailImportProblem("notFound", `Mailbox ${mailboxId} not found`);
		}
		targetMailboxIds.push(mailboxId);
	}

	if (!targetMailboxIds.length) {
		throw new EmailImportProblem(
			"invalidProperties",
			"mailboxIds must include at least one mailbox"
		);
	}

	const keywordsValue = raw.keywords;
	const keywords =
		keywordsValue && isRecord(keywordsValue) ? (keywordsValue as Record<string, boolean>) : {};

	return {
		blobId,
		mailboxIds: Array.from(new Set(targetMailboxIds)),
		keywords,
	};
}

async function loadEmailMetadataFromBlob(
	env: JMAPHonoAppEnv["Bindings"],
	db: ReturnType<typeof getDB>,
	accountId: string,
	blobId: string
): Promise<ParsedEmailMetadata> {
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
		throw new EmailImportProblem("blobNotFound", "Blob not found for this account");
	}

	const r2Key = blobRow.r2Key ?? blobId;
	const obj = await env.R2_EMAILS.get(r2Key);
	if (!obj || !obj.body) {
		throw new EmailImportProblem("blobNotFound", "Blob contents unavailable");
	}

	const rawBuffer = await obj.arrayBuffer();
	const parsed = await parseRawEmail(rawBuffer);
	const snippet = makeSnippet(parsed.email);
	const sentAt = parseSentAt(parsed.email);
	const size = rawBuffer.byteLength;
	const { structure, attachments } = await buildBodyStructure(parsed, size);
	const hasAttachment = attachments.length > 0;
	const bodyStructureJson = JSON.stringify(structure);

	return {
		email: parsed.email,
		attachments,
		snippet,
		sentAt,
		size,
		hasAttachment,
		bodyStructureJson,
	};
}

async function persistImportedEmail(opts: {
	tx: TransactionInstance;
	env: JMAPHonoAppEnv["Bindings"];
	accountId: string;
	mailboxIds: string[];
	blobId: string;
	metadata: ParsedEmailMetadata;
	keywords: Record<string, boolean>;
}): Promise<{ accountMessageId: string }> {
	const { tx, env, accountId, mailboxIds, blobId, metadata, keywords } = opts;
	const now = new Date();
	await upsertBlob(tx, blobId, metadata.size, now);

	const canonicalMessageId = await upsertCanonicalMessage({
		tx,
		ingestId: crypto.randomUUID(),
		rawBlobSha256: blobId,
		email: metadata.email,
		snippet: metadata.snippet,
		sentAt: metadata.sentAt,
		size: metadata.size,
		hasAttachment: metadata.hasAttachment,
		bodyStructureJson: metadata.bodyStructureJson,
		now,
	});

	await storeHeaders({ tx, canonicalMessageId, email: metadata.email });
	const attachmentBlobShas = await storeAttachments({
		tx,
		env,
		canonicalMessageId,
		attachments: metadata.attachments,
		now,
	});
	await storeAddresses({ tx, canonicalMessageId, email: metadata.email });

	await ensureAccountBlob(tx, accountId, blobId, now);
	for (const sha of attachmentBlobShas) {
		await ensureAccountBlob(tx, accountId, sha, now);
	}

	const threadId = await resolveOrCreateThreadId({
		tx,
		accountId,
		subject: metadata.email.subject ?? null,
		internalDate: now,
		inReplyTo: metadata.email.inReplyTo ?? null,
		referencesHeader: metadata.email.references ?? null,
	});

	const keywordResult = splitKeywords(keywords, {
		isSeen: false,
		isFlagged: false,
		isAnswered: false,
		isDraft: false,
	});

	const accountMessageId = crypto.randomUUID();

	await tx.insert(accountMessageTable).values({
		id: accountMessageId,
		accountId,
		messageId: canonicalMessageId,
		threadId,
		internalDate: now,
		isSeen: keywordResult.flags.isSeen,
		isFlagged: keywordResult.flags.isFlagged,
		isAnswered: keywordResult.flags.isAnswered,
		isDraft: keywordResult.flags.isDraft,
		isDeleted: false,
		createdAt: now,
		updatedAt: now,
	});

	if (mailboxIds.length > 0) {
		await tx.insert(mailboxMessageTable).values(
			mailboxIds.map((mailboxId) => ({
				accountMessageId,
				mailboxId,
				addedAt: now,
			}))
		);
	}

	if (keywordResult.custom.length > 0) {
		await tx.insert(emailKeywordTable).values(
			keywordResult.custom.map((keyword) => ({
				accountMessageId,
				keyword,
			}))
		);
	}

	await recordEmailCreateChanges({
		tx,
		accountId,
		accountMessageId,
		threadId,
		mailboxIds,
		now,
	});

	return { accountMessageId };
}

function splitKeywords(
	keywordPatch: Record<string, boolean>,
	baseFlags: ImportKeywordFlags
): { flags: ImportKeywordFlags; custom: string[] } {
	const flags: ImportKeywordFlags = { ...baseFlags };
	const custom: string[] = [];

	for (const [keyword, value] of Object.entries(keywordPatch)) {
		const normalized = normalizeKeywordName(keyword);
		const mapped = KEYWORD_FLAG_MAP[normalized];
		if (mapped) {
			flags[mapped] = value;
		} else if (value) {
			custom.push(normalized);
		}
	}

	return { flags, custom };
}

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

class EmailImportProblem extends Error {
	readonly type: string;

	constructor(type: string, message: string) {
		super(message);
		this.type = type;
	}
}
