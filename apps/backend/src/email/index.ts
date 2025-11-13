import { Attachment } from "postal-mime";

import { getDB } from "../db";
import { attachmentTable, blobTable } from "../db/schema"; // adjust path

export function getR2KeyFromHash(hash: string) {
	return `v1/raw/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.eml`;
}

// Convert PostalMime attachment content to Uint8Array
function attachmentToBytes(att: Attachment): Uint8Array {
	if (att.content instanceof ArrayBuffer) {
		return new Uint8Array(att.content);
	}

	const str = att.content ?? "";

	if (att.encoding === "base64") {
		const bin = atob(str); // available in Workers
		const out = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
		return out;
	}

	// utf8 or undefined => treat as plain text
	return new TextEncoder().encode(str);
}

export async function sha256Hex(data: ArrayBuffer | ArrayBufferView): Promise<string> {
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

// derive key from hash (no need to store it in DB)
function attachmentKeyFromHash(hash: string): string {
	return `v1/att/${hash.slice(0, 2)}/${hash}`; // tweak if you like
}

type StoreAttachmentsOpts = {
	attachments: Attachment[] | undefined;
	messageId: string;
	db: ReturnType<typeof getDB>; // or your concrete DB type
	attachmentsBucket: R2Bucket; // env.ATTACHMENTS_BUCKET
};

export async function storeAttachmentsForMessage({
	attachments,
	messageId,
	db,
	attachmentsBucket,
}: StoreAttachmentsOpts): Promise<void> {
	if (!attachments || attachments.length === 0) return;

	for (const att of attachments) {
		const bytes = attachmentToBytes(att);
		if (bytes.byteLength === 0) continue; // skip empty parts

		const sha = await sha256Hex(bytes);
		const key = attachmentKeyFromHash(sha);
		const mime = att.mimeType || "application/octet-stream";
		const filename = att.filename ?? null;
		const disposition = att.disposition ?? "attachment";

		const cid = att.contentId ?? null;

		// 1) Upload to R2 (idempotent "enough")
		await attachmentsBucket.put(key, bytes, {
			httpMetadata: { contentType: mime },
		});

		// 2) Upsert blob row (shared across messages)
		await db
			.insert(blobTable)
			.values({
				sha256: sha,
				size: bytes.byteLength,
			})
			.onConflictDoNothing();

		// 3) Insert attachment row (dedupe per messageId+sha)
		await db
			.insert(attachmentTable)
			.values({
				id: crypto.randomUUID(),
				messageId,
				filename,
				mime,
				size: bytes.byteLength,
				cid,
				disposition,
				sha256: sha,
			})
			.onConflictDoNothing({
				target: [attachmentTable.messageId, attachmentTable.sha256],
			});
	}
}
