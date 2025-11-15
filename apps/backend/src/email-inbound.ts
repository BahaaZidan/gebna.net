import { and, asc, eq, inArray } from "drizzle-orm";
import PostalMime, {
	Address as ParsedAddress,
	Attachment as ParsedAttachment,
	Email as ParsedEmail,
} from "postal-mime";

import { getDB, type TransactionInstance } from "./db";
import {
	accountMessageTable,
	accountTable,
	addressTable,
	attachmentTable,
	blobTable,
	mailboxMessageTable,
	mailboxTable,
	messageAddressTable,
	messageTable,
	threadTable,
} from "./db/schema";

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

function normalizeEmail(addr: string | null | undefined): string | null {
	if (!addr) return null;
	return addr.trim().toLowerCase();
}

async function sha256HexFromArrayBuffer(buffer: ArrayBuffer): Promise<string> {
	const hash = await crypto.subtle.digest("SHA-256", buffer);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function parseSentAt(email: ParsedEmail): Date | null {
	if (!email.date) return null;
	const d = new Date(email.date);
	if (Number.isNaN(d.getTime())) return null;
	return d;
}

function makeSnippet(email: ParsedEmail): string | null {
	if (email.text && email.text.trim()) {
		return email.text.trim().slice(0, 200);
	}
	if (email.html && email.html.trim()) {
		const text = email.html
			.replace(/<[^>]+>/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		if (text) return text.slice(0, 200);
	}
	return null;
}

// email.references is a single header string → extract <...> or fall back to whitespace split
function parseReferences(header: string | null | undefined): string[] {
	if (!header) return [];
	const matches = Array.from(header.matchAll(/<[^>]+>/g)).map((m) => m[0]);
	if (matches.length > 0) return matches;
	return header
		.split(/\s+/)
		.map((s) => s.trim())
		.filter(Boolean);
}

function attachmentContentToArrayBuffer(content: ArrayBuffer | string): ArrayBuffer {
	if (typeof content === "string") {
		const encoded = new TextEncoder().encode(content);
		return encoded.buffer as ArrayBuffer;
	}

	return content;
}

async function upsertBlob(
	tx: TransactionInstance,
	sha256: string,
	size: number,
	now: Date
): Promise<void> {
	await tx
		.insert(blobTable)
		.values({
			sha256,
			size,
			r2Key: sha256, // tweak if you use a different R2 key
			createdAt: now,
		})
		.onConflictDoNothing({ target: blobTable.sha256 });
}

async function upsertCanonicalMessage(opts: {
	tx: TransactionInstance;
	ingestId: string;
	rawBlobSha256: string;
	email: ParsedEmail;
	snippet: string | null;
	sentAt: Date | null;
	now: Date;
}): Promise<string> {
	const { tx, ingestId, rawBlobSha256, email, snippet, sentAt, now } = opts;

	const references = parseReferences(email.references ?? null);

	const inserted = await tx
		.insert(messageTable)
		.values({
			id: crypto.randomUUID(),
			ingestId,
			rawBlobSha256,
			messageId: email.messageId ?? null,
			inReplyTo: email.inReplyTo ?? null,
			referencesJson: references.length ? JSON.stringify(references) : null,
			subject: email.subject ?? null,
			snippet,
			sentAt: sentAt ?? null,
			createdAt: now,
			size: null,
		})
		.onConflictDoNothing({ target: messageTable.ingestId })
		.returning({ id: messageTable.id });

	if (inserted.length > 0) {
		return inserted[0]!.id;
	}

	const [existing] = await tx
		.select({ id: messageTable.id })
		.from(messageTable)
		.where(eq(messageTable.ingestId, ingestId))
		.limit(1);

	if (!existing) {
		throw new Error("Failed to upsert canonical message");
	}

	return existing.id;
}

async function storeAttachments(opts: {
	tx: TransactionInstance;
	canonicalMessageId: string;
	attachments: ParsedAttachment[];
	now: Date;
}): Promise<void> {
	const { tx, canonicalMessageId, attachments, now } = opts;

	for (let i = 0; i < attachments.length; i++) {
		const att = attachments[i]!;
		const ab = attachmentContentToArrayBuffer(att.content); // ArrayBuffer | string → ArrayBuffer
		const sha = await sha256HexFromArrayBuffer(ab);

		await upsertBlob(tx, sha, ab.byteLength, now);

		await tx.insert(attachmentTable).values({
			id: crypto.randomUUID(),
			messageId: canonicalMessageId,
			blobSha256: sha,
			filename: att.filename ?? null,
			mimeType: att.mimeType,
			disposition: att.disposition ?? null,
			contentId: att.contentId ?? null,
			related: att.related ?? false,
			position: i,
		});
	}
}

async function storeAddresses(opts: {
	tx: TransactionInstance;
	canonicalMessageId: string;
	email: ParsedEmail;
}): Promise<void> {
	const { tx, canonicalMessageId, email } = opts;

	const segments: { kind: string; addr: ParsedAddress; index: number }[] = [];

	if (email.from) {
		segments.push({ kind: "from", addr: email.from, index: 0 });
	}

	if (email.sender) {
		segments.push({ kind: "sender", addr: email.sender, index: 0 });
	}

	const pushList = (kind: string, list?: ParsedAddress[] | null) => {
		if (!list) return;
		list.forEach((addr, idx) => segments.push({ kind, addr, index: idx }));
	};

	pushList("reply-to", email.replyTo ?? null);
	pushList("to", email.to ?? null);
	pushList("cc", email.cc ?? null);
	pushList("bcc", email.bcc ?? null);

	for (const seg of segments) {
		const addr = seg.addr;
		const emailAddr = "address" in addr ? normalizeEmail(addr.address) : null;
		if (!emailAddr) continue;

		const [addrRow] = await tx
			.insert(addressTable)
			.values({
				id: crypto.randomUUID(),
				email: emailAddr,
				name: addr.name ?? null,
			})
			.returning({ id: addressTable.id });

		await tx.insert(messageAddressTable).values({
			messageId: canonicalMessageId,
			addressId: addrRow.id,
			kind: seg.kind,
			position: seg.index,
		});
	}
}

async function resolveOrCreateThreadId(opts: {
	tx: TransactionInstance;
	accountId: string;
	subject: string | null;
	internalDate: Date;
	inReplyTo: string | null;
	referencesHeader: string | null;
}): Promise<string> {
	const { tx, accountId, subject, internalDate, inReplyTo, referencesHeader } = opts;

	// 1) Try In-Reply-To
	if (inReplyTo) {
		const [row] = await tx
			.select({
				threadId: accountMessageTable.threadId,
			})
			.from(accountMessageTable)
			.innerJoin(messageTable, eq(accountMessageTable.messageId, messageTable.id))
			.where(
				and(eq(accountMessageTable.accountId, accountId), eq(messageTable.messageId, inReplyTo))
			)
			.limit(1);

		if (row) {
			await tx
				.update(threadTable)
				.set({ latestMessageAt: internalDate })
				.where(eq(threadTable.id, row.threadId));
			return row.threadId;
		}
	}

	// 2) Try References
	const referenceIds = parseReferences(referencesHeader ?? null);
	if (referenceIds.length > 0) {
		const rows = await tx
			.select({
				threadId: accountMessageTable.threadId,
			})
			.from(accountMessageTable)
			.innerJoin(messageTable, eq(accountMessageTable.messageId, messageTable.id))
			.where(
				and(
					eq(accountMessageTable.accountId, accountId),
					inArray(messageTable.messageId, referenceIds)
				)
			)
			.orderBy(asc(accountMessageTable.internalDate))
			.limit(1);

		const row = rows[0];
		if (row) {
			await tx
				.update(threadTable)
				.set({ latestMessageAt: internalDate })
				.where(eq(threadTable.id, row.threadId));
			return row.threadId;
		}
	}

	// 3) New thread
	const threadId = crypto.randomUUID();
	await tx.insert(threadTable).values({
		id: threadId,
		accountId,
		subject,
		createdAt: internalDate,
		latestMessageAt: internalDate,
	});
	return threadId;
}

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

		// Hash + parse from the same raw bytes
		const rawBuffer = await new Response(message.raw).arrayBuffer();
		const rawSha = await sha256HexFromArrayBuffer(rawBuffer);

		const email: ParsedEmail = await PostalMime.parse(rawBuffer);
		const snippet = makeSnippet(email);
		const sentAt = parseSentAt(email);

		// One canonical message per unique raw MIME
		const ingestId = rawSha;

		await db.transaction(async (tx) => {
			// 1) Blob for raw MIME
			await upsertBlob(tx, rawSha, rawBuffer.byteLength, now);

			// 2) Canonical message
			const canonicalMessageId = await upsertCanonicalMessage({
				tx,
				ingestId,
				rawBlobSha256: rawSha,
				email,
				snippet,
				sentAt,
				now,
			});

			// 3) Attachments
			await storeAttachments({
				tx,
				canonicalMessageId,
				attachments: (email.attachments ?? []) as ParsedAttachment[],
				now,
			});

			// 4) Addresses
			await storeAddresses({ tx, canonicalMessageId, email });

			// 5) Per-recipient handling
			// Cloudflare ForwardableEmailMessage.to is the envelope recipient
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
				// Not a local account → drop but log
				console.warn("No local account for recipient", rcpt);
				return;
			}

			const accountId = accountRow.id;
			const internalDate = now;

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
			const inboxId = await getInboxMailboxId(tx, accountId);
			if (!inboxId) {
				console.warn("No Inbox mailbox for account", accountId);
			} else {
				await tx
					.insert(mailboxMessageTable)
					.values({
						accountMessageId,
						mailboxId: inboxId,
						addedAt: now,
					})
					.onConflictDoNothing();
			}
		});

		console.log("Inbound email stored with ingestId", ingestId);
	} catch (err) {
		console.error("Error handling inbound email", err);
		// Don't rethrow → avoid CF retry storms / duplicate delivery
	}
}
