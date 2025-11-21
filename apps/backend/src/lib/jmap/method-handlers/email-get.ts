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
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type StoredBodyPart = {
	partId?: string;
	type?: string;
	subtype?: string;
	[key: string]: unknown;
};

type StoredBodyStructure = {
	size?: number;
	isTruncated?: boolean;
	parts?: StoredBodyPart[];
};

type BodyValueRecord = {
	value: string;
	isTruncated: boolean;
	charset: string;
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

	const propertiesArg = args.properties as string[] | undefined;
	const properties = Array.isArray(propertiesArg) ? propertiesArg : undefined;

	const rows = await db
		.select({
			emailId: accountMessageTable.id,
			messageId: messageTable.id,
			threadId: accountMessageTable.threadId,
			internalDate: accountMessageTable.internalDate,
			subject: messageTable.subject,
			snippet: messageTable.snippet,
			sentAt: messageTable.sentAt,
			rawBlobSha256: messageTable.rawBlobSha256,
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
				inArray(accountMessageTable.id, ids)
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

	const mailboxMap = new Map<string, string[]>();
	for (const row of mailboxRows) {
		const arr = mailboxMap.get(row.emailId) ?? [];
		arr.push(row.mailboxId);
		mailboxMap.set(row.emailId, arr);
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
				.where(
					inArray(
						messageAddressTable.messageId,
						rows.map((r) => r.messageId)
					)
				)
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
							inArray(
								messageHeaderTable.messageId,
								rows.map((r) => r.messageId)
							),
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
	const list: EmailRecord[] = [];

	for (const row of rows) {
		const email: EmailRecord = { id: row.emailId };

		if (shouldInclude("threadId")) email.threadId = row.threadId;
		if (shouldInclude("mailboxIds")) email.mailboxIds = mailboxMap.get(row.emailId) ?? [];
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

		const addrKinds = addrsByMsg.get(row.messageId) ?? {};
		if (shouldInclude("from")) email.from = addrKinds["from"] ?? [];
		if (shouldInclude("to")) email.to = addrKinds["to"] ?? [];
		if (shouldInclude("cc")) email.cc = addrKinds["cc"] ?? [];
		if (shouldInclude("bcc")) email.bcc = addrKinds["bcc"] ?? [];
		if (shouldInclude("replyTo")) email.replyTo = addrKinds["reply-to"] ?? [];
		if (shouldInclude("sender")) email.sender = addrKinds["sender"] ?? [];

		for (const [prop, lowerName] of headerLowerByProp.entries()) {
			const values = headersByMessage.get(row.messageId)?.get(lowerName);
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
			email.bodyStructure = parsedStructure
				? {
						size: parsedStructure.size ?? null,
						isTruncated: parsedStructure.isTruncated ?? false,
						parts: (parsedStructure.parts ?? []).map((part) => filterBodyPart(part, bodyPropertySet)),
				  }
				: null;
		}

		if (includeTextBody && parsedStructure) {
			email.textBody = (parsedStructure.parts ?? [])
				.filter(
					(part) =>
						typeof part.type === "string" &&
						part.type.toLowerCase() === "text" &&
						typeof part.subtype === "string" &&
						part.subtype.toLowerCase() === "plain"
				)
				.map((part) => filterBodyPart(part, bodyPropertySet));
		}

		if (includeHtmlBody && parsedStructure) {
			email.htmlBody = (parsedStructure.parts ?? [])
				.filter(
					(part) =>
						typeof part.type === "string" &&
						part.type.toLowerCase() === "text" &&
						typeof part.subtype === "string" &&
						part.subtype.toLowerCase() === "html"
				)
				.map((part) => filterBodyPart(part, bodyPropertySet));
		}

		if (needBodyValues && parsedStructure) {
			const bodyValues =
				buildBodyValuesFromStored({
					row,
					structure: parsedStructure,
					includeText: fetchAllBodyValues || fetchTextBodyValues || includeBodyValuesProp,
					includeHtml: fetchAllBodyValues || fetchHTMLBodyValues || includeBodyValuesProp,
					maxBytes: maxBodyValueBytes,
				}) ?? {};
			email.bodyValues = bodyValues;
		}

		list.push(email);
	}

	const foundIds = new Set(list.map((e) => e.id));
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
		return parsed as StoredBodyStructure;
	} catch {
		return null;
	}
}

function filterBodyPart(part: StoredBodyPart, allowed: Set<string>): Record<string, unknown> {
	const output: Record<string, unknown> = {};
	if (part.partId !== undefined) output.partId = part.partId;
	if (part.type !== undefined) output.type = part.type;
	if (part.subtype !== undefined) output.subtype = part.subtype;

	for (const key of allowed) {
		if (key === "partId" || key === "type" || key === "subtype") continue;
		if (part[key] !== undefined) {
			output[key] = part[key];
		}
	}
	return output;
}

function buildBodyValuesFromStored(params: {
	row: StoredBodyRow;
	structure: StoredBodyStructure;
	includeText: boolean;
	includeHtml: boolean;
	maxBytes: number;
}): Record<string, BodyValueRecord> | null {
	const { row, structure, includeText, includeHtml, maxBytes } = params;
	if (!includeText && !includeHtml) {
		return null;
	}

	const parts = structure.parts ?? [];
	const textPart = parts.find(
		(part) =>
			typeof part.type === "string" &&
			part.type.toLowerCase() === "text" &&
			typeof part.subtype === "string" &&
			part.subtype.toLowerCase() === "plain"
	);
	const htmlPart = parts.find(
		(part) =>
			typeof part.type === "string" &&
			part.type.toLowerCase() === "text" &&
			typeof part.subtype === "string" &&
			part.subtype.toLowerCase() === "html"
	);

	if (!textPart?.partId && !htmlPart?.partId) {
		return {};
	}

	const bodyValues: Record<string, BodyValueRecord> = {};

	if (includeText && textPart?.partId && typeof row.textBody === "string") {
		const { value, isTruncated } = truncateStringToBytes(row.textBody, maxBytes);
		bodyValues[textPart.partId] = {
			value,
			isTruncated: isTruncated || Boolean(row.textBodyIsTruncated),
			charset: "UTF-8",
		};
	}

	if (includeHtml && htmlPart?.partId && typeof row.htmlBody === "string") {
		const { value, isTruncated } = truncateStringToBytes(row.htmlBody, maxBytes);
		bodyValues[htmlPart.partId] = {
			value,
			isTruncated: isTruncated || Boolean(row.htmlBodyIsTruncated),
			charset: "UTF-8",
		};
	}

	return bodyValues;
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
