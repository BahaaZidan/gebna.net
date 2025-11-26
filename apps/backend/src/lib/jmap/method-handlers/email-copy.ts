import { and, eq } from "drizzle-orm";
import { Context } from "hono";

import { getDB, TransactionInstance } from "../../../db";
import {
	accountMessageTable,
	emailKeywordTable,
	mailboxMessageTable,
	messageTable,
} from "../../../db/schema";
import { ensureAccountBlob } from "../../mail/ingest";
import { recordEmailCreateChanges } from "../change-log";
import { JMAPHonoAppEnv } from "../middlewares";
import { CreationReferenceMap, JmapMethodResponse } from "../types";
import { applyEmailSet } from "./email-set";
import {
	ensureAccountAccess,
	getAccountMailboxes,
	getAccountState,
	isRecord,
	resolveCreationReference,
} from "../utils";

const KEYWORD_FLAG_MAP: Record<string, keyof KeywordFlags> = {
	$seen: "isSeen",
	"\\seen": "isSeen",
	$flagged: "isFlagged",
	"\\flagged": "isFlagged",
	$answered: "isAnswered",
	"\\answered": "isAnswered",
	$draft: "isDraft",
	"\\draft": "isDraft",
};

type KeywordFlags = {
	isSeen: boolean;
	isFlagged: boolean;
	isAnswered: boolean;
	isDraft: boolean;
};

type EmailCopyArgs = {
	accountId: string;
	create?: Record<string, unknown>;
	creationRefs?: CreationReferenceMap;
};

type EmailCopyResult = {
	accountId: string;
	oldState: string;
	newState: string;
	created: Record<string, unknown>;
	notCreated: Record<string, { type: string; description?: string }>;
	destroySourceIds: string[];
};

export async function handleEmailCopy(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse | JmapMethodResponse[]> {
	const db = getDB(c.env);
	const accountIdArg = args.accountId as string | undefined;
	const effectiveAccountId = ensureAccountAccess(c, accountIdArg);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const fromAccountId = (args.fromAccountId as string | undefined) ?? effectiveAccountId;
	if (fromAccountId !== effectiveAccountId) {
		return [
			"error",
			{ type: "accountNotFound", description: "Cross-account copy not supported" },
			tag,
		];
	}

	const state = await getAccountState(db, effectiveAccountId, "Email");

	const onSuccessDestroyOriginalValue = args.onSuccessDestroyOriginal;
	if (
		onSuccessDestroyOriginalValue !== undefined &&
		typeof onSuccessDestroyOriginalValue !== "boolean"
	) {
		return [
			"error",
			{ type: "invalidArguments", description: "onSuccessDestroyOriginal must be a boolean" },
			tag,
		];
	}
	const shouldDestroyOriginal = onSuccessDestroyOriginalValue === true;

	const input: EmailCopyArgs = {
		accountId: effectiveAccountId,
		create: (args.create as Record<string, unknown> | undefined) ?? undefined,
		creationRefs: c.get("creationReferences") as CreationReferenceMap | undefined,
	};

	const result = await applyEmailCopy(db, input);

	const responses: JmapMethodResponse[] = [
		[
			"Email/copy",
			{
				accountId: result.accountId,
				oldState: state,
				newState: result.newState,
				created: result.created,
				notCreated: result.notCreated,
			},
			tag,
		],
	];

	if (shouldDestroyOriginal && result.destroySourceIds.length > 0) {
		const destroyIds = Array.from(new Set(result.destroySourceIds));
		const emailSetResult = await applyEmailSet(c.env, db, {
			accountId: effectiveAccountId,
			destroy: destroyIds,
		});
		responses.push([
			"Email/set",
			{
				accountId: emailSetResult.accountId,
				oldState: emailSetResult.oldState,
				newState: emailSetResult.newState,
				created: emailSetResult.created,
				notCreated: emailSetResult.notCreated,
				updated: emailSetResult.updated,
				notUpdated: emailSetResult.notUpdated,
				destroyed: emailSetResult.destroyed,
				notDestroyed: emailSetResult.notDestroyed,
			},
			tag,
		]);
	}

	return responses.length === 1 ? responses[0]! : responses;
}

async function applyEmailCopy(
	db: ReturnType<typeof getDB>,
	args: EmailCopyArgs
): Promise<EmailCopyResult> {
	const accountId = args.accountId;
	const createMap = args.create ?? {};
	const creationRefs = args.creationRefs;

	const created: Record<string, unknown> = {};
	const notCreated: Record<string, { type: string; description?: string }> = {};
	const destroySourceIds: string[] = [];

	const oldState = await getAccountState(db, accountId, "Email");
	const mailboxInfo = await getAccountMailboxes(db, accountId);

	await db.transaction(async (tx) => {
		for (const [creationId, raw] of Object.entries(createMap)) {
			try {
				const parsed = parseEmailCopyCreate(raw, mailboxInfo.byId, creationRefs);
				const createResult = await cloneEmail(tx, accountId, parsed, mailboxInfo.byId);
				created[creationId] = { id: createResult.accountMessageId };
				destroySourceIds.push(parsed.emailId);
			} catch (err) {
				if (err instanceof EmailCopyProblem) {
					notCreated[creationId] = { type: err.type, description: err.message };
					continue;
				}
				throw err;
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
		destroySourceIds,
	};
}

type EmailCopyCreate = {
	emailId: string;
	mailboxIds: string[];
	keywords: Record<string, boolean> | null;
};

function parseEmailCopyCreate(
	raw: unknown,
	mailboxLookup: Map<string, { id: string; role: string | null }>,
	creationRefs?: CreationReferenceMap
): EmailCopyCreate {
	if (!isRecord(raw)) {
		throw new EmailCopyProblem("invalidProperties", "Create entry must be an object");
	}

	const emailIdValue = raw.id;
	if (typeof emailIdValue !== "string" || !emailIdValue) {
		throw new EmailCopyProblem("invalidProperties", "id must be a string");
	}
	let emailId = emailIdValue;

	if (emailId.startsWith("#")) {
		const resolved = resolveCreationReference(emailId, creationRefs);
		if (!resolved) {
			throw new EmailCopyProblem("invalidProperties", `Unknown creation id reference ${emailId}`);
		}
		emailId = resolved;
	}

	const mailboxIdsValue = raw.mailboxIds;
	if (!isRecord(mailboxIdsValue)) {
		throw new EmailCopyProblem("invalidProperties", "mailboxIds must be provided");
	}

	const targetMailboxIds: string[] = [];
	for (const [mailboxId, keep] of Object.entries(mailboxIdsValue)) {
		if (keep !== true) continue;
		let resolvedMailboxId = mailboxId;
		if (mailboxId.startsWith("#")) {
			const resolved = resolveCreationReference(mailboxId, creationRefs);
			if (!resolved) {
				throw new EmailCopyProblem("invalidProperties", `Unknown mailbox reference ${mailboxId}`);
			}
			resolvedMailboxId = resolved;
		}
		if (!mailboxLookup.has(resolvedMailboxId)) {
			throw new EmailCopyProblem("notFound", `Mailbox ${mailboxId} not found`);
		}
		targetMailboxIds.push(resolvedMailboxId);
	}

	if (!targetMailboxIds.length) {
		throw new EmailCopyProblem("invalidProperties", "mailboxIds must include at least one mailbox");
	}

	const keywordsValue = raw.keywords;
	let keywords: Record<string, boolean> | null = null;
	if (keywordsValue !== undefined) {
		if (!isRecord(keywordsValue)) {
			throw new EmailCopyProblem("invalidProperties", "keywords must be an object");
		}
		keywords = {};
		for (const [keyword, value] of Object.entries(keywordsValue)) {
			if (typeof value === "boolean") {
				keywords[keyword] = value;
			}
		}
	}

	return {
		emailId,
		mailboxIds: targetMailboxIds,
		keywords,
	};
}

async function cloneEmail(
	tx: TransactionInstance,
	accountId: string,
	create: EmailCopyCreate,
	_mailboxLookup: Map<string, { id: string; role: string | null }>
): Promise<{ accountMessageId: string }> {
	const [source] = await tx
		.select({
			accountMessageId: accountMessageTable.id,
			messageId: accountMessageTable.messageId,
			threadId: accountMessageTable.threadId,
			isSeen: accountMessageTable.isSeen,
			isFlagged: accountMessageTable.isFlagged,
			isAnswered: accountMessageTable.isAnswered,
			isDraft: accountMessageTable.isDraft,
		})
		.from(accountMessageTable)
		.where(
			and(
				eq(accountMessageTable.id, create.emailId),
				eq(accountMessageTable.accountId, accountId),
				eq(accountMessageTable.isDeleted, false)
			)
		)
		.limit(1);

	if (!source) {
		throw new EmailCopyProblem("notFound", "Email not found");
	}

	const customKeywordRows = await tx
		.select({ keyword: emailKeywordTable.keyword })
		.from(emailKeywordTable)
		.where(eq(emailKeywordTable.accountMessageId, source.accountMessageId));

	const baseKeywordMap: Record<string, boolean> = {
		$seen: source.isSeen,
		$flagged: source.isFlagged,
		$answered: source.isAnswered,
		$draft: source.isDraft,
	};
	for (const row of customKeywordRows) {
		baseKeywordMap[row.keyword] = true;
	}

	const effectiveKeywordMap = create.keywords ?? baseKeywordMap;
	const { flags, custom } = splitKeywords(effectiveKeywordMap, {
		isSeen: source.isSeen,
		isFlagged: source.isFlagged,
		isAnswered: source.isAnswered,
		isDraft: source.isDraft,
	});

	const now = new Date();
	const newId = crypto.randomUUID();

	await tx.insert(accountMessageTable).values({
		id: newId,
		accountId,
		messageId: source.messageId,
		threadId: source.threadId,
		internalDate: now,
		isSeen: flags.isSeen,
		isFlagged: flags.isFlagged,
		isAnswered: flags.isAnswered,
		isDraft: flags.isDraft,
		isDeleted: false,
		createdAt: now,
		updatedAt: now,
	});

	await tx.insert(mailboxMessageTable).values(
		create.mailboxIds.map((mailboxId) => ({
			accountMessageId: newId,
			mailboxId,
			addedAt: now,
		}))
	);

	if (custom.length > 0) {
		await tx.insert(emailKeywordTable).values(
			custom.map((keyword: string) => ({
				accountMessageId: newId,
				keyword,
			}))
		);
	}

	const [messageRow] = await tx
		.select({ sha: messageTable.rawBlobSha256 })
		.from(messageTable)
		.where(eq(messageTable.id, source.messageId))
		.limit(1);

	if (messageRow?.sha) {
		await ensureAccountBlob(tx, accountId, messageRow.sha, now);
	}

	await recordEmailCreateChanges({
		tx,
		accountId,
		accountMessageId: newId,
		threadId: source.threadId,
		mailboxIds: create.mailboxIds,
		now,
	});

	return { accountMessageId: newId };
}

function splitKeywords(
	keywordPatch: Record<string, boolean>,
	baseFlags: KeywordFlags
): { flags: KeywordFlags; custom: string[] } {
	const flags: KeywordFlags = { ...baseFlags };
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

class EmailCopyProblem extends Error {
	readonly type: string;

	constructor(type: string, message: string) {
		super(message);
		this.type = type;
	}
}
