import { and, asc, eq, inArray, sql } from "drizzle-orm";
import PostalMime, {
	Address as ParsedAddress,
	Attachment as ParsedAttachment,
	Email as ParsedEmail,
} from "postal-mime";

import { getDB, type TransactionInstance } from "./db";
import {
	accountBlobTable,
	accountMessageTable,
	accountTable,
	addressTable,
	attachmentTable,
	blobTable,
	changeLogTable,
	jmapStateTable,
	mailboxMessageTable,
	mailboxTable,
	messageAddressTable,
	messageHeaderTable,
	messageTable,
	threadTable,
} from "./db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "./lib/jmap/constants";
import { sha256HexFromArrayBuffer } from "./lib/utils";

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

const MAX_RAW_BYTES = JMAP_CONSTRAINTS[JMAP_CORE].maxSizeUpload;

function normalizeEmail(addr: string | null | undefined): string | null {
	if (!addr) return null;
	return addr.trim().toLowerCase();
}

function normalizeMessageId(id: string | null | undefined): string | null {
	if (!id) return null;
	const trimmed = id.trim();
	const match = trimmed.match(/^<(.+)>$/);
	if (match) return match[1];
	return trimmed;
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
	const idList: string[] = [];

	const matches = Array.from(header.matchAll(/<[^>]+>/g));
	for (const m of matches) {
		const norm = normalizeMessageId(m[0]);
		if (norm) idList.push(norm);
	}

	if (idList.length > 0) return idList;

	const parts = header.split(/\s+/);
	for (const raw of parts) {
		const norm = normalizeMessageId(raw);
		if (norm) idList.push(norm);
	}

	return idList;
}

function attachmentContentToArrayBuffer(content: ArrayBuffer | string): ArrayBuffer {
	if (typeof content === "string") {
		const encoded = new TextEncoder().encode(content);
		return encoded.buffer as ArrayBuffer;
	}
	return content;
}

async function ensureBlobInR2(
	env: CloudflareBindings,
	key: string,
	content: ArrayBuffer
): Promise<void> {
	const head = await env.R2_EMAILS.head(key);
	if (!head) {
		await env.R2_EMAILS.put(key, new Uint8Array(content));
	}
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
			r2Key: sha256,
			createdAt: now,
		})
		.onConflictDoNothing({ target: blobTable.sha256 });
}

async function ensureAccountBlob(
	tx: TransactionInstance,
	accountId: string,
	sha256: string,
	now: Date
): Promise<void> {
	await tx
		.insert(accountBlobTable)
		.values({
			accountId,
			sha256,
			createdAt: now,
		})
		.onConflictDoNothing({
			target: [accountBlobTable.accountId, accountBlobTable.sha256],
		});
}

type SimpleBodyPart = {
	partId: string;
	type: string;
	subtype: string;
	size: number | null;
	disposition?: string | null;
	filename?: string | null;
	cid?: string | null;
	related?: boolean;
};

function buildBodyStructure(email: ParsedEmail, rawSize: number): unknown {
	const parts: SimpleBodyPart[] = [];
	let partCounter = 1;

	if (email.text) {
		parts.push({
			partId: String(partCounter++),
			type: "text",
			subtype: "plain",
			size: email.text.length,
		});
	}

	if (email.html) {
		parts.push({
			partId: String(partCounter++),
			type: "text",
			subtype: "html",
			size: email.html.length,
		});
	}

	for (const att of (email.attachments ?? []) as ParsedAttachment[]) {
		const mime = att.mimeType ?? "application/octet-stream";
		const [type, subtype] = mime.split("/");
		let size: number | null = null;

		if (typeof att.content === "string") {
			size = att.content.length;
		} else if (att.content instanceof ArrayBuffer) {
			size = att.content.byteLength;
		}

		parts.push({
			partId: String(partCounter++),
			type: type || "application",
			subtype: subtype || "octet-stream",
			size,
			disposition: att.disposition ?? null,
			filename: att.filename ?? null,
			cid: att.contentId ?? null,
			related: att.related ?? false,
		});
	}

	return {
		size: rawSize,
		parts,
	};
}

async function upsertCanonicalMessage(opts: {
	tx: TransactionInstance;
	ingestId: string;
	rawBlobSha256: string;
	email: ParsedEmail;
	snippet: string | null;
	sentAt: Date | null;
	size: number;
	hasAttachment: boolean;
	bodyStructureJson: string | null;
	now: Date;
}): Promise<string> {
	const {
		tx,
		ingestId,
		rawBlobSha256,
		email,
		snippet,
		sentAt,
		size,
		hasAttachment,
		bodyStructureJson,
		now,
	} = opts;

	const references = parseReferences(email.references ?? null);
	const messageId = normalizeMessageId(email.messageId);
	const inReplyTo = normalizeMessageId(email.inReplyTo);

	const inserted = await tx
		.insert(messageTable)
		.values({
			id: crypto.randomUUID(),
			ingestId,
			rawBlobSha256,
			messageId,
			inReplyTo,
			referencesJson: references.length ? JSON.stringify(references) : null,
			subject: email.subject ?? null,
			snippet,
			sentAt: sentAt ?? null,
			createdAt: now,
			size,
			hasAttachment,
			bodyStructureJson,
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
	env: CloudflareBindings;
	canonicalMessageId: string;
	attachments: ParsedAttachment[];
	now: Date;
}): Promise<void> {
	const { tx, env, canonicalMessageId, attachments, now } = opts;

	for (let i = 0; i < attachments.length; i++) {
		const att = attachments[i]!;
		const ab = attachmentContentToArrayBuffer(att.content);
		const sha = await sha256HexFromArrayBuffer(ab);

		await ensureBlobInR2(env, sha, ab);
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

		const [inserted] = await tx
			.insert(addressTable)
			.values({
				id: crypto.randomUUID(),
				email: emailAddr,
				name: addr.name ?? null,
			})
			.onConflictDoNothing({ target: addressTable.email })
			.returning({ id: addressTable.id });

		let addressId = inserted?.id as string | undefined;

		if (!addressId) {
			const [existing] = await tx
				.select({ id: addressTable.id })
				.from(addressTable)
				.where(eq(addressTable.email, emailAddr))
				.limit(1);

			if (!existing) {
				throw new Error("Failed to upsert address");
			}
			addressId = existing.id;
		}

		await tx.insert(messageAddressTable).values({
			messageId: canonicalMessageId,
			addressId,
			kind: seg.kind,
			position: seg.index,
		});
	}
}

async function storeHeaders(opts: {
	tx: TransactionInstance;
	canonicalMessageId: string;
	email: ParsedEmail;
}): Promise<void> {
	const { tx, canonicalMessageId, email } = opts;

	const headers = email.headers ?? [];
	if (!Array.isArray(headers) || headers.length === 0) return;

	for (const h of headers) {
		const name = h.key;
		const value = h.value;
		if (!name || !value) continue;
		const lowerName = name.toLowerCase();

		await tx.insert(messageHeaderTable).values({
			messageId: canonicalMessageId,
			name,
			lowerName,
			value,
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
	const normalizedInReplyTo = normalizeMessageId(inReplyTo);
	if (normalizedInReplyTo) {
		const [row] = await tx
			.select({
				threadId: accountMessageTable.threadId,
			})
			.from(accountMessageTable)
			.innerJoin(messageTable, eq(accountMessageTable.messageId, messageTable.id))
			.where(
				and(
					eq(accountMessageTable.accountId, accountId),
					eq(messageTable.messageId, normalizedInReplyTo)
				)
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
		modSeq: emailModSeq,
		createdAt: now,
	});

	const threadModSeq = await bumpState(tx, accountId, "Thread");
	await tx.insert(changeLogTable).values({
		id: crypto.randomUUID(),
		accountId,
		type: "Thread",
		objectId: threadId,
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

		const email: ParsedEmail = await PostalMime.parse(rawBuffer);
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
			await storeAttachments({
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
			const attachmentBlobs = await tx
				.select({ sha256: attachmentTable.blobSha256 })
				.from(attachmentTable)
				.where(eq(attachmentTable.messageId, canonicalMessageId));

			for (const row of attachmentBlobs) {
				await ensureAccountBlob(tx, accountId, row.sha256, now);
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
