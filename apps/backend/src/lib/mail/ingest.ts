import { and, asc, eq, inArray } from "drizzle-orm";
import PostalMime, {
	Address as ParsedAddress,
	Attachment as ParsedAttachment,
	Email as ParsedEmail,
} from "postal-mime";

import { TransactionInstance } from "../../db";
import {
	accountBlobTable,
	accountMessageTable,
	addressTable,
	attachmentTable,
	blobTable,
	messageAddressTable,
	messageHeaderTable,
	messageTable,
	threadTable,
} from "../../db/schema";
import { sha256HexFromArrayBuffer } from "../utils";

const storedBodyEncoder = new TextEncoder();
const storedBodyDecoder = new TextDecoder();
const MAX_STORED_BODY_BYTES = 256 * 1024;

export function normalizeEmail(addr: string | null | undefined): string | null {
	if (!addr) return null;
	return addr.trim().toLowerCase();
}

export function normalizeMessageId(id: string | null | undefined): string | null {
	if (!id) return null;
	const trimmed = id.trim();
	const match = trimmed.match(/^<(.+)>$/);
	if (match) return match[1];
	return trimmed;
}

export function parseSentAt(email: ParsedEmail): Date | null {
	if (!email.date) return null;
	const d = new Date(email.date);
	if (Number.isNaN(d.getTime())) return null;
	return d;
}

export function makeSnippet(email: ParsedEmail): string | null {
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
export function parseReferences(header: string | null | undefined): string[] {
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

export function attachmentContentToArrayBuffer(content: ArrayBuffer | string): ArrayBuffer {
	if (typeof content === "string") {
		const encoded = new TextEncoder().encode(content);
		return encoded.buffer as ArrayBuffer;
	}
	return content;
}

function prepareStoredBody(value: string | null | undefined): {
	content: string | null;
	truncated: boolean;
} {
	if (!value) {
		return { content: null, truncated: false };
	}
	const normalized = value.replace(/\r\n/g, "\n");
	const encoded = storedBodyEncoder.encode(normalized);
	if (encoded.byteLength <= MAX_STORED_BODY_BYTES) {
		return { content: normalized, truncated: false };
	}
	const sliced = encoded.slice(0, MAX_STORED_BODY_BYTES);
	const decoded = storedBodyDecoder.decode(sliced);
	return { content: decoded, truncated: true };
}

export async function ensureBlobInR2(
	env: CloudflareBindings,
	key: string,
	content: ArrayBuffer
): Promise<void> {
	const head = await env.R2_EMAILS.head(key);
	if (!head) {
		await env.R2_EMAILS.put(key, new Uint8Array(content));
	}
}

export async function upsertBlob(
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

export async function ensureAccountBlob(
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

export function buildBodyStructure(email: ParsedEmail, rawSize: number): unknown {
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
		isTruncated: false,
		parts,
	};
}

export async function upsertCanonicalMessage(opts: {
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
	const storedText = prepareStoredBody(email.text ?? null);
	const storedHtml = prepareStoredBody(email.html ?? null);

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
			textBody: storedText.content,
			textBodyIsTruncated: storedText.truncated,
			htmlBody: storedHtml.content,
			htmlBodyIsTruncated: storedHtml.truncated,
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

export async function storeAttachments(opts: {
	tx: TransactionInstance;
	env: CloudflareBindings;
	canonicalMessageId: string;
	attachments: ParsedAttachment[];
	now: Date;
}): Promise<string[]> {
	const { tx, env, canonicalMessageId, attachments, now } = opts;
	const linkedBlobs: string[] = [];

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

		linkedBlobs.push(sha);
	}

	return linkedBlobs;
}

export async function storeAddresses(opts: {
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

export async function storeHeaders(opts: {
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

export async function resolveOrCreateThreadId(opts: {
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

export async function parseRawEmail(rawBuffer: ArrayBuffer): Promise<ParsedEmail> {
	return PostalMime.parse(rawBuffer);
}
