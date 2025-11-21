import { and, eq, inArray } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import {
	accountMessageTable,
	addressTable,
	emailKeywordTable,
	mailboxMessageTable,
	messageAddressTable,
	messageHeaderTable,
	messageTable,
} from "../../../db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";
import { parseRawEmail } from "../../mail/ingest";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const INGEST_BODY_CACHE_LIMIT = 256 * 1024;

type StoredBodyPart = {
	partId: string;
	type: string;
	subtype: string;
	parameters: Record<string, string>;
	size: number | null;
	blobId: string | null;
	charset: string | null;
	disposition: string | null;
	name: string | null;
	cid: string | null;
	isInline: boolean;
	parts?: StoredBodyPart[];
};

type StoredBodyStructure = StoredBodyPart;

type BodyValueRecord = {
	value: string;
	isTruncated: boolean;
	charset: string;
};

type AttachmentRecord = {
	partId: string;
	blobId: string;
	type: string;
	size: number;
	name: string | null;
	cid: string | null;
	disposition: string | null;
	isInline: boolean;
};

type StoredBodyRow = {
	textBody: string | null;
	textBodyIsTruncated: boolean | null;
	htmlBody: string | null;
	htmlBodyIsTruncated: boolean | null;
};

export async function handleEmailGet(
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

	const ids = (args.ids as string[] | undefined) ?? [];
	if (!ids.length) {
		return ["Email/get", { accountId: effectiveAccountId, state, list: [], notFound: [] }, tag];
	}
	const maxObjectsLimit = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	const limitedIds = ids.slice(0, maxObjectsLimit);
	if (!limitedIds.length) {
		return ["Email/get", { accountId: effectiveAccountId, state, list: [], notFound: ids }, tag];
	}

	const propertiesArg = args.properties as string[] | undefined;
	const properties = Array.isArray(propertiesArg) ? propertiesArg : undefined;

	const rows = await db
		.select({
			emailId: accountMessageTable.id,
			messageId: messageTable.id,
			headerMessageId: messageTable.messageId,
			threadId: accountMessageTable.threadId,
			internalDate: accountMessageTable.internalDate,
			subject: messageTable.subject,
			snippet: messageTable.snippet,
			sentAt: messageTable.sentAt,
			rawBlobSha256: messageTable.rawBlobSha256,
			inReplyTo: messageTable.inReplyTo,
			referencesJson: messageTable.referencesJson,
			size: messageTable.size,
			hasAttachment: messageTable.hasAttachment,
			bodyStructureJson: messageTable.bodyStructureJson,
			textBody: messageTable.textBody,
			textBodyIsTruncated: messageTable.textBodyIsTruncated,
			htmlBody: messageTable.htmlBody,
			htmlBodyIsTruncated: messageTable.htmlBodyIsTruncated,
			isSeen: accountMessageTable.isSeen,
			isFlagged: accountMessageTable.isFlagged,
			isAnswered: accountMessageTable.isAnswered,
			isDraft: accountMessageTable.isDraft,
		})
		.from(accountMessageTable)
		.innerJoin(messageTable, eq(accountMessageTable.messageId, messageTable.id))
		.where(
			and(
				eq(accountMessageTable.accountId, effectiveAccountId),
				eq(accountMessageTable.isDeleted, false),
				inArray(accountMessageTable.id, limitedIds)
			)
		);

	if (!rows.length) {
		return ["Email/get", { accountId: effectiveAccountId, state, list: [], notFound: ids }, tag];
	}

	const includeAllProperties = !properties;
	const propsSet = properties ? new Set(properties) : null;
	const shouldInclude = (prop: string) => includeAllProperties || propsSet?.has(prop) || false;

	const bodyPropertiesInput = args.bodyProperties as string[] | undefined;
	const defaultBodyProperties = ["partId", "type", "subtype", "size", "name", "cid", "disposition"];
	const bodyProperties =
		Array.isArray(bodyPropertiesInput) && bodyPropertiesInput.length > 0
			? bodyPropertiesInput
			: defaultBodyProperties;
	const bodyPropertySet = new Set(bodyProperties);
	bodyPropertySet.add("partId");
	bodyPropertySet.add("type");
	bodyPropertySet.add("subtype");

	const includeBodyStructure = shouldInclude("bodyStructure");
	const includeTextBody = shouldInclude("textBody");
	const includeHtmlBody = shouldInclude("htmlBody");
	const includeBodyValuesProp = shouldInclude("bodyValues");

	const fetchTextBodyValues = Boolean(args.fetchTextBodyValues);
	const fetchHTMLBodyValues = Boolean(args.fetchHTMLBodyValues);
	const fetchAllBodyValues = Boolean(args.fetchAllBodyValues);
	const shouldReturnBodyValues =
		includeBodyValuesProp || fetchTextBodyValues || fetchHTMLBodyValues || fetchAllBodyValues;
	const needBodyValues = shouldReturnBodyValues;

	const maxBodyValueBytesArg = args.maxBodyValueBytes;
	const maxBodyValueBytes =
		typeof maxBodyValueBytesArg === "number" && Number.isFinite(maxBodyValueBytesArg) && maxBodyValueBytesArg > 0
			? maxBodyValueBytesArg
			: 64 * 1024;

	const canonicalMessageIds: string[] = rows.map((row) => row.messageId as string);

	const mailboxRows = shouldInclude("mailboxIds")
		? await db
				.select({
					emailId: mailboxMessageTable.accountMessageId,
					mailboxId: mailboxMessageTable.mailboxId,
				})
				.from(mailboxMessageTable)
				.where(
					inArray(
						mailboxMessageTable.accountMessageId,
						rows.map((r) => r.emailId)
					)
				)
		: [];

	const mailboxMap = new Map<string, Record<string, boolean>>();
	for (const row of mailboxRows) {
		let entry = mailboxMap.get(row.emailId);
		if (!entry) {
			entry = {};
			mailboxMap.set(row.emailId, entry);
		}
		entry[row.mailboxId] = true;
	}

	const keywordRows = shouldInclude("keywords")
		? await db
				.select({
					emailId: emailKeywordTable.accountMessageId,
					keyword: emailKeywordTable.keyword,
				})
				.from(emailKeywordTable)
				.where(
					inArray(
						emailKeywordTable.accountMessageId,
						rows.map((r) => r.emailId)
					)
				)
		: [];

	const customKeywords = new Map<string, string[]>();
	for (const row of keywordRows) {
		const arr = customKeywords.get(row.emailId) ?? [];
		arr.push(row.keyword);
		customKeywords.set(row.emailId, arr);
	}

	const needsAddresses = ["from", "to", "cc", "bcc", "replyTo", "sender"].some((prop) =>
		shouldInclude(prop)
	);

	const addressRows = needsAddresses
		? await db
				.select({
					messageId: messageAddressTable.messageId,
					kind: messageAddressTable.kind,
					position: messageAddressTable.position,
					email: addressTable.email,
					name: addressTable.name,
				})
				.from(messageAddressTable)
				.innerJoin(addressTable, eq(messageAddressTable.addressId, addressTable.id))
					.where(inArray(messageAddressTable.messageId, canonicalMessageIds))
		: [];

	type JmapEmailAddress = { email: string; name?: string | null };
	const addrsByMsg = new Map<string, Record<string, JmapEmailAddress[]>>();

	for (const row of addressRows) {
		const perMsg = addrsByMsg.get(row.messageId) ?? {};
		const list = perMsg[row.kind] ?? [];
		list[row.position] = {
			email: row.email,
			name: row.name,
		};
		perMsg[row.kind] = list;
		addrsByMsg.set(row.messageId, perMsg);
	}

	const headerProps =
		properties?.filter((prop) => typeof prop === "string" && prop.startsWith("header:")) ?? [];
	const headerLowerByProp = new Map<string, string>();
	for (const prop of headerProps) {
		const headerName = prop.slice(7);
		if (!headerName) continue;
		headerLowerByProp.set(prop, headerName.toLowerCase());
	}

	const headerRows =
		headerLowerByProp.size > 0
			? await db
					.select({
						messageId: messageHeaderTable.messageId,
						lowerName: messageHeaderTable.lowerName,
						value: messageHeaderTable.value,
					})
					.from(messageHeaderTable)
					.where(
						and(
								inArray(messageHeaderTable.messageId, canonicalMessageIds),
							inArray(messageHeaderTable.lowerName, Array.from(new Set(headerLowerByProp.values())))
						)
					)
			: [];

	const headersByMessage = new Map<string, Map<string, string[]>>();
	for (const row of headerRows) {
		const perMessage = headersByMessage.get(row.messageId) ?? new Map<string, string[]>();
		const list = perMessage.get(row.lowerName) ?? [];
		list.push(row.value);
		perMessage.set(row.lowerName, list);
		headersByMessage.set(row.messageId, perMessage);
	}

	type EmailRecord = Record<string, unknown> & { id: string };
	const emailsById = new Map<string, EmailRecord>();

	for (const row of rows) {
		const email: EmailRecord = { id: row.emailId };
		const canonicalMessageId = row.messageId as string;

		if (shouldInclude("threadId")) email.threadId = row.threadId;
		if (shouldInclude("mailboxIds")) email.mailboxIds = mailboxMap.get(row.emailId) ?? {};
		if (shouldInclude("messageId")) email.messageId = row.headerMessageId ?? null;
		if (shouldInclude("inReplyTo")) email.inReplyTo = row.inReplyTo ?? null;
		if (shouldInclude("references")) {
			email.references = parseReferencesArray(row.referencesJson ?? null);
		}
		if (shouldInclude("subject")) email.subject = row.subject;
		if (shouldInclude("sentAt")) {
			email.sentAt = row.sentAt ? new Date(row.sentAt).toISOString() : null;
		}
		if (shouldInclude("receivedAt")) {
			email.receivedAt = new Date(row.internalDate).toISOString();
		}
		if (shouldInclude("preview")) email.preview = row.snippet;
		if (shouldInclude("size")) email.size = row.size;
		if (shouldInclude("blobId")) email.blobId = row.rawBlobSha256;
		if (shouldInclude("hasAttachment")) email.hasAttachment = row.hasAttachment;

		if (shouldInclude("keywords")) {
			const kw: Record<string, boolean> = {};
			if (row.isSeen) kw["$seen"] = true;
			if (row.isFlagged) kw["$flagged"] = true;
			if (row.isAnswered) kw["$answered"] = true;
			if (row.isDraft) kw["$draft"] = true;
			const customList = customKeywords.get(row.emailId) ?? [];
			for (const keyword of customList) {
				kw[keyword] = true;
			}
			email.keywords = kw;
		}

		const addrKinds = addrsByMsg.get(canonicalMessageId) ?? {};
		if (shouldInclude("from")) email.from = addrKinds["from"] ?? [];
		if (shouldInclude("to")) email.to = addrKinds["to"] ?? [];
		if (shouldInclude("cc")) email.cc = addrKinds["cc"] ?? [];
		if (shouldInclude("bcc")) email.bcc = addrKinds["bcc"] ?? [];
		if (shouldInclude("replyTo")) email.replyTo = addrKinds["reply-to"] ?? [];
		if (shouldInclude("sender")) email.sender = addrKinds["sender"] ?? [];

		for (const [prop, lowerName] of headerLowerByProp.entries()) {
			const values = headersByMessage.get(canonicalMessageId)?.get(lowerName);
			if (!values || values.length === 0) {
				email[prop] = null;
			} else if (values.length === 1) {
				email[prop] = values[0];
			} else {
				email[prop] = values;
			}
		}

		const parsedStructure =
			(includeBodyStructure || includeTextBody || includeHtmlBody || needBodyValues) &&
			row.bodyStructureJson
				? parseBodyStructure(row.bodyStructureJson)
				: null;

		if (includeBodyStructure) {
			email.bodyStructure = parsedStructure ? filterBodyPart(parsedStructure, bodyPropertySet) : null;
		}

		if (shouldInclude("attachments")) {
			email.attachments = parsedStructure ? collectAttachmentsFromStructure(parsedStructure) : [];
		}

		if (includeTextBody && parsedStructure) {
			const plainParts = collectBodyParts(parsedStructure, (part) => part.type === "text" && part.subtype === "plain");
			email.textBody = plainParts.map((part) => filterBodyPart(part, bodyPropertySet));
		}

		if (includeHtmlBody && parsedStructure) {
			const htmlParts = collectBodyParts(parsedStructure, (part) => part.type === "text" && part.subtype === "html");
			email.htmlBody = htmlParts.map((part) => filterBodyPart(part, bodyPropertySet));
		}

		if (needBodyValues && parsedStructure) {
			const { values: storedBodyValues, missingPartIds } = buildBodyValuesFromStored({
				row,
				structure: parsedStructure,
				includeText: fetchAllBodyValues || fetchTextBodyValues || includeBodyValuesProp,
				includeHtml: fetchAllBodyValues || fetchHTMLBodyValues || includeBodyValuesProp,
				maxBytes: maxBodyValueBytes,
			});

			const combinedValues = { ...storedBodyValues };
			if (missingPartIds.length > 0) {
				try {
					const streamedValues = await fetchBodyValuesFromRawMime({
						env: c.env,
						rawBlobSha: row.rawBlobSha256,
						partIds: missingPartIds,
						maxBytes: maxBodyValueBytes,
						structure: parsedStructure,
					});
					for (const [partId, record] of Object.entries(streamedValues)) {
						combinedValues[partId] = record;
					}
				} catch (err) {
					console.warn("Failed to stream bodyValues", err);
				}
			}

			if (Object.keys(combinedValues).length > 0) {
				email.bodyValues = combinedValues;
			}
		}

		emailsById.set(row.emailId, email);
	}

	const list: EmailRecord[] = [];
	const foundIds = new Set<string>();
	for (const id of limitedIds) {
		const email = emailsById.get(id);
		if (!email) continue;
		list.push(email);
		foundIds.add(id);
	}
	const notFound = ids.filter((id) => !foundIds.has(id));

	return [
		"Email/get",
		{
			accountId: effectiveAccountId,
			state,
			list,
			notFound,
		},
		tag,
	];
}

function parseBodyStructure(json: string): StoredBodyStructure | null {
	try {
		const parsed = JSON.parse(json);
		if (!parsed || typeof parsed !== "object") return null;
		const candidate = parsed as StoredBodyStructure;
		if (typeof candidate.partId !== "string") return null;
		return candidate;
	} catch {
		return null;
	}
}

function parseReferencesArray(json: string | null): string[] {
	if (!json) return [];
	try {
		const parsed = JSON.parse(json);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter((value): value is string => typeof value === "string");
	} catch {
		return [];
	}
}

function filterBodyPart(part: StoredBodyPart, allowed: Set<string>): Record<string, unknown> {
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

function buildBodyValuesFromStored(params: {
	row: StoredBodyRow;
	structure: StoredBodyStructure;
	includeText: boolean;
	includeHtml: boolean;
	maxBytes: number;
}): { values: Record<string, BodyValueRecord>; missingPartIds: string[] } {
	const { row, structure, includeText, includeHtml, maxBytes } = params;
	const values: Record<string, BodyValueRecord> = {};
	const missing = new Set<string>();

	if (!structure) {
		return { values, missingPartIds: [] };
	}

	if (includeText) {
		const textParts = collectBodyParts(structure, (part) => part.type === "text" && part.subtype === "plain");
		textParts.forEach((part, index) => {
			const canUseStored = index === 0 && typeof row.textBody === "string";
			if (canUseStored) {
				const { value, isTruncated } = truncateStringToBytes(row.textBody!, maxBytes);
				values[part.partId] = {
					value,
					isTruncated: isTruncated || Boolean(row.textBodyIsTruncated),
					charset: part.charset ?? "UTF-8",
				};
				if (row.textBodyIsTruncated && maxBytes > INGEST_BODY_CACHE_LIMIT) {
					missing.add(part.partId);
				}
			} else {
				missing.add(part.partId);
			}
		});
	}

	if (includeHtml) {
		const htmlParts = collectBodyParts(structure, (part) => part.type === "text" && part.subtype === "html");
		htmlParts.forEach((part, index) => {
			const canUseStored = index === 0 && typeof row.htmlBody === "string";
			if (canUseStored) {
				const { value, isTruncated } = truncateStringToBytes(row.htmlBody!, maxBytes);
				values[part.partId] = {
					value,
					isTruncated: isTruncated || Boolean(row.htmlBodyIsTruncated),
					charset: part.charset ?? "UTF-8",
				};
				if (row.htmlBodyIsTruncated && maxBytes > INGEST_BODY_CACHE_LIMIT) {
					missing.add(part.partId);
				}
			} else {
				missing.add(part.partId);
			}
		});
	}

	return { values, missingPartIds: Array.from(missing) };
}

function findBodyPart(
	part: StoredBodyPart | null,
	predicate: (part: StoredBodyPart) => boolean
): StoredBodyPart | null {
	if (!part) return null;
	if (predicate(part)) {
		return part;
	}
	for (const child of part.parts ?? []) {
		const match = findBodyPart(child, predicate);
		if (match) return match;
	}
	return null;
}

function collectBodyParts(
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

function collectAttachmentsFromStructure(part: StoredBodyPart | null): AttachmentRecord[] {
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

async function fetchBodyValuesFromRawMime(params: {
	env: JMAPHonoAppEnv["Bindings"];
	rawBlobSha: string | null;
	partIds: string[];
	maxBytes: number;
	structure: StoredBodyStructure;
}): Promise<Record<string, BodyValueRecord>> {
	const { env, rawBlobSha, partIds, maxBytes, structure } = params;
	if (!rawBlobSha || partIds.length === 0) {
		return {};
	}
	const object = await env.R2_EMAILS.get(rawBlobSha);
	if (!object || !object.body) {
		return {};
	}
	const rawBuffer = await object.arrayBuffer();
	const parsed = await parseRawEmail(rawBuffer);
	const needed = new Set(partIds);
	const collected = new Map<string, string>();
	collectMimeTextParts(parsed.mimeTree, needed, collected, null, 0);

	const result: Record<string, BodyValueRecord> = {};
	for (const partId of partIds) {
		const content = collected.get(partId);
		if (!content) continue;
		const { value, isTruncated } = truncateStringToBytes(content, maxBytes);
		const charset = findBodyPart(structure, (part) => part.partId === partId)?.charset ?? "UTF-8";
		result[partId] = {
			value,
			isTruncated,
			charset: charset ?? "UTF-8",
		};
	}
	return result;
}

function collectMimeTextParts(
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

function extractMimeNodeText(node: {
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


function truncateStringToBytes(value: string, maxBytes: number): { value: string; isTruncated: boolean } {
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
