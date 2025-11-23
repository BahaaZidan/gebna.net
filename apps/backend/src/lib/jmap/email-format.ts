import { addressParser, decodeWords } from "postal-mime";

import type { StoredBodyPart } from "../mail/ingest";

export type StoredBodyStructure = StoredBodyPart;

export type BodyValueRecord = {
	value: string;
	isTruncated: boolean;
	charset: string;
};

export type HeaderFetchMode = "raw" | "text" | "addresses";

export type HeaderSpec = { lowerName: string; mode: HeaderFetchMode };

export type JmapEmailAddress = { email: string; name?: string | null };

export type AttachmentRecord = {
	partId: string;
	blobId: string;
	type: string;
	size: number;
	name: string | null;
	cid: string | null;
	disposition: string | null;
	isInline: boolean;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function parseHeaderProperty(prop: string): HeaderSpec | null {
	if (typeof prop !== "string" || !prop.startsWith("header:")) return null;
	let remainder = prop.slice(7);
	if (!remainder) return null;
	let mode: HeaderFetchMode = "raw";
	const suffixMatch = remainder.match(/:(asText|asRaw|asAddresses)$/i);
	if (suffixMatch) {
		const suffix = suffixMatch[1]?.toLowerCase();
		switch (suffix) {
			case "astext":
				mode = "text";
				break;
			case "asaddresses":
				mode = "addresses";
				break;
			default:
				mode = "raw";
		}
		remainder = remainder.slice(0, -suffixMatch[0].length);
	}
	if (!remainder) return null;
	return { lowerName: remainder.toLowerCase(), mode };
}

export function formatHeaderValues(values: string[] | undefined, mode: HeaderFetchMode): unknown {
	if (!values || values.length === 0) {
		return null;
	}
	switch (mode) {
		case "text": {
			const decoded = values.map(decodeHeaderValue);
			return decoded.length === 1 ? decoded[0] : decoded;
		}
		case "addresses": {
			const addresses = parseAddressHeaderValues(values);
			return addresses;
		}
		case "raw":
		default:
			return values.length === 1 ? values[0] : values;
	}
}

function decodeHeaderValue(value: string): string {
	try {
		return decodeWords(value);
	} catch {
		return value;
	}
}

function parseAddressHeaderValues(values: string[]): JmapEmailAddress[] {
	const result: JmapEmailAddress[] = [];
	for (const raw of values) {
		try {
			const parsed = addressParser(raw) ?? [];
			for (const entry of parsed) {
				appendAddressEntry(entry, result);
			}
		} catch {
			continue;
		}
	}
	return result;
}

function appendAddressEntry(entry: unknown, target: JmapEmailAddress[]): void {
	if (!entry || typeof entry !== "object") return;
	const maybeMailbox = entry as { address?: string | null; name?: string | null; group?: unknown };
	if (typeof maybeMailbox.address === "string" && maybeMailbox.address.length > 0) {
		target.push({
			email: maybeMailbox.address,
			name: maybeMailbox.name ?? null,
		});
		return;
	}
	const group = maybeMailbox.group;
	if (Array.isArray(group)) {
		const groupEntries: unknown[] = group;
		for (const child of groupEntries) {
			appendAddressEntry(child, target);
		}
	}
}

export function filterBodyPart(part: StoredBodyPart, allowed: Set<string>): Record<string, unknown> {
	const output: Record<string, unknown> = {};
	const include = (key: string, value: unknown, force = false) => {
		if (value === undefined) return;
		if (!force && !allowed.has(key)) return;
		output[key] = value;
	};

	include("partId", part.partId, true);
	include("type", part.type, true);
	include("subtype", part.subtype, true);
	include("parameters", part.parameters);
	include("size", part.size);
	include("blobId", part.blobId);
	include("charset", part.charset);
	include("disposition", part.disposition);
	include("name", part.name);
	include("cid", part.cid);
	include("isInline", part.isInline);

	if (part.parts && part.parts.length) {
		output.parts = part.parts.map((child) => filterBodyPart(child, allowed));
	}

	return output;
}

export function collectBodyParts(
	part: StoredBodyPart | null,
	predicate: (part: StoredBodyPart) => boolean
): StoredBodyPart[] {
	if (!part) return [];
	const matches: StoredBodyPart[] = [];
	const walk = (node: StoredBodyPart) => {
		if (predicate(node)) {
			matches.push(node);
		}
		for (const child of node.parts ?? []) {
			walk(child);
		}
	};
	walk(part);
	return matches;
}

export function collectAttachmentsFromStructure(part: StoredBodyPart | null): AttachmentRecord[] {
	if (!part) return [];
	const records: AttachmentRecord[] = [];
	const walk = (node: StoredBodyPart) => {
		if (node.blobId) {
			records.push({
				partId: node.partId,
				blobId: node.blobId,
				type: `${node.type}/${node.subtype}`,
				size: node.size ?? 0,
				name: node.name ?? null,
				cid: node.cid ?? null,
				disposition: node.disposition ?? null,
				isInline: Boolean(node.isInline),
			});
		}
		for (const child of node.parts ?? []) {
			walk(child);
		}
	};
	walk(part);
	return records;
}

export function collectMimeTextParts(
	node: unknown,
	needed: Set<string>,
	collected: Map<string, string>,
	parentPartId: string | null,
	index: number
): void {
	if (!node || typeof node !== "object") return;
	const anyNode = node as {
		childNodes?: unknown[];
		contentType?: { parsed?: { value?: string } };
		getTextContent?: () => string;
		content?: Uint8Array;
	};
	const partId = parentPartId ? `${parentPartId}.${index + 1}` : String(index + 1);
	const children = Array.isArray(anyNode.childNodes) ? anyNode.childNodes : [];
	const mediaType = (anyNode.contentType?.parsed?.value ?? "").toLowerCase();
	if (!children.length && mediaType.startsWith("text/") && needed.has(partId)) {
		const text = extractMimeNodeText(anyNode);
		if (typeof text === "string") {
			collected.set(partId, text);
		}
	}
	for (let i = 0; i < children.length; i++) {
		collectMimeTextParts(children[i], needed, collected, partId, i);
	}
}

export function extractMimeNodeText(node: {
	getTextContent?: () => string;
	content?: Uint8Array;
}): string | null {
	if (typeof node.getTextContent === "function") {
		try {
			return node.getTextContent();
		} catch {
			return null;
		}
	}
	if (node.content instanceof Uint8Array) {
		try {
			return textDecoder.decode(node.content);
		} catch {
			return null;
		}
	}
	return null;
}

export function truncateStringToBytes(value: string, maxBytes: number): { value: string; isTruncated: boolean } {
	const encoded = textEncoder.encode(value);
	if (encoded.byteLength <= maxBytes) {
		return { value, isTruncated: false };
	}
	const truncated = encoded.slice(0, maxBytes);
	return {
		value: textDecoder.decode(truncated),
		isTruncated: true,
	};
}
