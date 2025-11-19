import { and, eq, sql } from "drizzle-orm";
import type { Attachment as ParsedAttachment, Email as ParsedEmail } from "postal-mime";

import { getDB, type TransactionInstance } from "./db";
import {
	accountMessageTable,
	accountTable,
	changeLogTable,
	jmapStateTable,
	mailboxMessageTable,
	mailboxTable,
} from "./db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "./lib/jmap/constants";
import {
	buildBodyStructure,
	ensureAccountBlob,
	ensureBlobInR2,
	makeSnippet,
	normalizeEmail,
	parseRawEmail,
	parseSentAt,
	resolveOrCreateThreadId,
	storeAddresses,
	storeAttachments,
	storeHeaders,
	upsertBlob,
	upsertCanonicalMessage,
} from "./lib/mail/ingest";
import { sha256HexFromArrayBuffer } from "./lib/utils";

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

const MAX_RAW_BYTES = JMAP_CONSTRAINTS[JMAP_CORE].maxSizeUpload;


async function getInboxMailboxId(
	tx: TransactionInstance,
	accountId: string
): Promise<string | null> {
	const [byRole] = await tx
		.select({ id: mailboxTable.id })
		.from(mailboxTable)
		.where(and(eq(mailboxTable.accountId, accountId), eq(mailboxTable.role, "inbox")))
		.limit(1);

	if (byRole) return byRole.id;

	const [byName] = await tx
		.select({ id: mailboxTable.id })
		.from(mailboxTable)
		.where(and(eq(mailboxTable.accountId, accountId), eq(mailboxTable.name, "Inbox")))
		.limit(1);

	return byName?.id ?? null;
}

async function bumpState(
	tx: TransactionInstance,
	accountId: string,
	type: "Email" | "Mailbox" | "Thread"
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

async function recordInboundChanges(opts: {
	tx: TransactionInstance;
	accountId: string;
	accountMessageId: string;
	threadId: string;
	mailboxIds: string[];
	now: Date;
}): Promise<void> {
	const { tx, accountId, accountMessageId, threadId, mailboxIds, now } = opts;

	const emailModSeq = await bumpState(tx, accountId, "Email");
	await tx.insert(changeLogTable).values({
		id: crypto.randomUUID(),
		accountId,
		type: "Email",
		objectId: accountMessageId,
		op: "create",
		modSeq: emailModSeq,
		createdAt: now,
	});

	const threadModSeq = await bumpState(tx, accountId, "Thread");
	await tx.insert(changeLogTable).values({
		id: crypto.randomUUID(),
		accountId,
		type: "Thread",
		objectId: threadId,
		op: "create",
		modSeq: threadModSeq,
		createdAt: now,
	});

	if (mailboxIds.length > 0) {
		const mailboxModSeq = await bumpState(tx, accountId, "Mailbox");
		for (const mailboxId of mailboxIds) {
			await tx.insert(changeLogTable).values({
				id: crypto.randomUUID(),
				accountId,
				type: "Mailbox",
				objectId: mailboxId,
				op: "create",
				modSeq: mailboxModSeq,
				createdAt: now,
			});
		}
	}
}

// ───────────────────────────────────────────────────────────
// Cloudflare Email Worker entrypoint
// ───────────────────────────────────────────────────────────

export async function email(
	message: ForwardableEmailMessage,
	env: CloudflareBindings,
	_ctx: ExecutionContext
) {
	const db = getDB(env);

	try {
		const now = new Date();

		const rawBuffer = await new Response(message.raw).arrayBuffer();
		if (rawBuffer.byteLength > MAX_RAW_BYTES) {
			console.warn("Inbound email too large, dropping", {
				size: rawBuffer.byteLength,
				to: message.to,
			});
			return;
		}

		const rawSha = await sha256HexFromArrayBuffer(rawBuffer);

		const email: ParsedEmail = await parseRawEmail(rawBuffer);
		const snippet = makeSnippet(email);
		const sentAt = parseSentAt(email);
		const size = rawBuffer.byteLength;
		const hasAttachment = (email.attachments?.length ?? 0) > 0;
		const bodyStructure = buildBodyStructure(email, size);
		const bodyStructureJson = JSON.stringify(bodyStructure);

		const ingestId = rawSha;

		await ensureBlobInR2(env, rawSha, rawBuffer);

		await db.transaction(async (tx) => {
			// 1) Blob for raw MIME
			await upsertBlob(tx, rawSha, size, now);

			// 2) Canonical message
			const canonicalMessageId = await upsertCanonicalMessage({
				tx,
				ingestId,
				rawBlobSha256: rawSha,
				email,
				snippet,
				sentAt,
				size,
				hasAttachment,
				bodyStructureJson,
				now,
			});

			// 3) Headers
			await storeHeaders({ tx, canonicalMessageId, email });

			// 4) Attachments
			const attachmentBlobShas = await storeAttachments({
				tx,
				env,
				canonicalMessageId,
				attachments: (email.attachments ?? []) as ParsedAttachment[],
				now,
			});

			// 5) Addresses
			await storeAddresses({ tx, canonicalMessageId, email });

			// 6) Per-recipient handling
			const rcpt = normalizeEmail(message.to);
			if (!rcpt) {
				console.warn("Inbound email with empty recipient");
				return;
			}

			const [accountRow] = await tx
				.select({ id: accountTable.id })
				.from(accountTable)
				.where(eq(accountTable.address, rcpt))
				.limit(1);

			if (!accountRow) {
				console.warn("No local account for recipient", rcpt);
				return;
			}

			const accountId = accountRow.id;
			const internalDate = now;

			// Link blobs to account (raw MIME)
			await ensureAccountBlob(tx, accountId, rawSha, now);

			// Link blobs to account (attachments)
			for (const sha of attachmentBlobShas) {
				await ensureAccountBlob(tx, accountId, sha, now);
			}

			const threadId = await resolveOrCreateThreadId({
				tx,
				accountId,
				subject: email.subject ?? null,
				internalDate,
				inReplyTo: email.inReplyTo ?? null,
				referencesHeader: email.references ?? null,
			});

			// accountMessage (per-account listing)
			const insertResult = await tx
				.insert(accountMessageTable)
				.values({
					id: crypto.randomUUID(),
					accountId,
					messageId: canonicalMessageId,
					threadId,
					internalDate,
					isSeen: false,
					isFlagged: false,
					isAnswered: false,
					isDraft: false,
					isDeleted: false,
					createdAt: now,
					updatedAt: now,
				})
				.onConflictDoNothing({
					target: [accountMessageTable.accountId, accountMessageTable.messageId],
				})
				.returning({ id: accountMessageTable.id });

			let accountMessageId = insertResult[0]?.id as string | undefined;

			if (!accountMessageId) {
				const [existing] = await tx
					.select({ id: accountMessageTable.id })
					.from(accountMessageTable)
					.where(
						and(
							eq(accountMessageTable.accountId, accountId),
							eq(accountMessageTable.messageId, canonicalMessageId)
						)
					)
					.limit(1);

				if (!existing) {
					throw new Error("Failed to upsert accountMessage");
				}
				accountMessageId = existing.id;
			}

			// Put into Inbox
			const mailboxIds: string[] = [];
			const inboxId = await getInboxMailboxId(tx, accountId);
			if (!inboxId) {
				console.warn("No Inbox mailbox for account", accountId);
			} else {
				mailboxIds.push(inboxId);
				await tx
					.insert(mailboxMessageTable)
					.values({
						accountMessageId,
						mailboxId: inboxId,
						addedAt: now,
					})
					.onConflictDoNothing();
			}

			// Record JMAP changes for /changes
			await recordInboundChanges({
				tx,
				accountId,
				accountMessageId,
				threadId,
				mailboxIds,
				now,
			});
		});

		console.log("Inbound email stored with ingestId", ingestId);
	} catch (err) {
		console.error("Error handling inbound email", err);
	}
}
