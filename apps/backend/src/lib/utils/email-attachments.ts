import type { Attachment } from "postal-mime";

const utf8Encoder = new TextEncoder();

export function getAttachmentBytes(attachment: Attachment): Uint8Array {
	const content = attachment.content;
	if (typeof content === "string") {
		if (attachment.encoding === "base64") {
			return decodeBase64ToBytes(content);
		}
		return utf8Encoder.encode(content);
	}
	if (content instanceof ArrayBuffer) return new Uint8Array(content);
	return new Uint8Array();
}

export function buildCidResolver(attachments: Attachment[]) {
	const map = new Map<string, string>();

	for (const attachment of attachments) {
		if (!attachment.contentId) continue;
		const mimeType = attachment.mimeType || "";
		if (!mimeType.startsWith("image/")) continue;

		const normalized = normalizeContentId(attachment.contentId);
		if (!normalized || map.has(normalized)) continue;

		const bytes = getAttachmentBytes(attachment);
		const base64 = encodeBase64(bytes);
		if (!base64) continue;

		map.set(normalized, `data:${mimeType};base64,${base64}`);
	}

	if (!map.size) return undefined;
	return (cid: string) => map.get(normalizeContentId(cid)) ?? null;
}

function normalizeContentId(value: string) {
	const trimmed = value.trim();
	const withoutBrackets = trimmed.replace(/^<|>$/g, "");
	const withoutPrefix = withoutBrackets.toLowerCase().startsWith("cid:")
		? withoutBrackets.slice(4)
		: withoutBrackets;
	return withoutPrefix.trim().toLowerCase();
}

function encodeBase64(bytes: Uint8Array) {
	if (typeof btoa === "function") {
		let binary = "";
		for (let i = 0; i < bytes.length; i += 1) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}
	if (typeof Buffer !== "undefined") {
		return Buffer.from(bytes).toString("base64");
	}
	return "";
}

function decodeBase64ToBytes(base64: string) {
	if (typeof atob === "function") {
		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
		return bytes;
	}
	if (typeof Buffer !== "undefined") {
		return Uint8Array.from(Buffer.from(base64, "base64"));
	}
	return new Uint8Array();
}
