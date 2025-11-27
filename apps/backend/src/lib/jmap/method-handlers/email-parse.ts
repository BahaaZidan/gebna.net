import { v } from "@gebna/validation";
import { and, eq, inArray } from "drizzle-orm";
import { Context } from "hono";
import type { Address as ParsedAddress } from "postal-mime";

import { getDB } from "../../../db";
import { accountBlobTable, blobTable } from "../../../db/schema";
import {
	buildBodyStructure,
	makeSnippet,
	normalizeMessageId,
	parseRawEmail,
	parseReferences,
	parseSentAt,
	type StoredBodyPart,
} from "../../mail/ingest";
import {
	AttachmentRecord,
	BodyValueRecord,
	HeaderSpec,
	JmapEmailAddress,
	collectAttachmentsFromStructure,
	collectBodyParts,
	collectMimeTextParts,
	filterBodyPart,
	formatHeaderValues,
	parseHeaderProperty,
	truncateStringToBytes,
} from "../email-format";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess } from "../utils";

const DEFAULT_BODY_PROPERTIES = ["partId", "type", "subtype", "size", "name", "cid", "disposition"];
const DEFAULT_MAX_BODY_VALUE_BYTES = 64 * 1024;
const EMAIL_PARSE_ALLOWED_PROPERTIES = new Set([
	"blobId",
	"size",
	"subject",
	"messageId",
	"inReplyTo",
	"references",
	"sentAt",
	"receivedAt",
	"preview",
	"hasAttachment",
	"keywords",
	"mailboxIds",
	"threadId",
	"bodyStructure",
	"attachments",
	"textBody",
	"htmlBody",
	"bodyValues",
	"from",
	"to",
	"cc",
	"bcc",
	"replyTo",
	"sender",
]);

const EmailParseArgsSchema = v.object({
	accountId: v.optional(v.string()),
	blobIds: v.array(v.string()),
	properties: v.optional(v.array(v.string())),
	bodyProperties: v.optional(v.array(v.string())),
	fetchTextBodyValues: v.optional(v.boolean()),
	fetchHTMLBodyValues: v.optional(v.boolean()),
	fetchAllBodyValues: v.optional(v.boolean()),
	maxBodyValueBytes: v.optional(v.number()),
	allowMissingIds: v.optional(v.boolean()),
});

type EmailParseArgs = v.InferOutput<typeof EmailParseArgsSchema>;

export async function handleEmailParse(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const parsedArgs = v.safeParse(EmailParseArgsSchema, args);
	if (!parsedArgs.success) {
		return [
			"error",
			{ type: "invalidArguments", description: parsedArgs.issues[0]?.message ?? "Invalid arguments" },
			tag,
		];
	}

	const input: EmailParseArgs = parsedArgs.output;
	const blobIds = input.blobIds;
	if (blobIds.length === 0) {
		return ["error", { type: "invalidArguments", description: "blobIds must include at least one id" }, tag];
	}
	const maxObjectsLimit = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInGet ?? 256;
	if (blobIds.length > maxObjectsLimit) {
		return [
			"error",
			{
				type: "requestTooLarge",
				description: `blobIds length exceeds maxObjectsInGet (${maxObjectsLimit})`,
			},
			tag,
		];
	}

	const db = getDB(c.env);
	const effectiveAccountId = ensureAccountAccess(c, input.accountId);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const allowMissingIds = input.allowMissingIds !== undefined ? Boolean(input.allowMissingIds) : true;
	const bodyProperties = input.bodyProperties ?? DEFAULT_BODY_PROPERTIES;
	const bodyPropertySet = new Set(bodyProperties);
	bodyPropertySet.add("partId");
	bodyPropertySet.add("type");
	bodyPropertySet.add("subtype");

	const propertiesResult = parseEmailParseProperties(input.properties);
	if ("error" in propertiesResult) {
		return ["error", { type: "invalidArguments", description: propertiesResult.error }, tag];
	}
	const propertySet = propertiesResult.properties;
	const includeAllProperties = propertySet === null;
	const shouldInclude = (prop: string) => includeAllProperties || propertySet?.has(prop) || false;

	const includeBodyStructure = shouldInclude("bodyStructure");
	const includeTextBody = shouldInclude("textBody");
	const includeHtmlBody = shouldInclude("htmlBody");
	const includeBodyValuesProp = shouldInclude("bodyValues");

	const fetchTextBodyValues = Boolean(input.fetchTextBodyValues);
	const fetchHTMLBodyValues = Boolean(input.fetchHTMLBodyValues);
	const fetchAllBodyValues = Boolean(input.fetchAllBodyValues);
	const shouldReturnBodyValues =
		includeBodyValuesProp || fetchTextBodyValues || fetchHTMLBodyValues || fetchAllBodyValues;

	const maxBodyValueBytes = normalizeMaxBodyValueBytes(input.maxBodyValueBytes);

	const headerSpecs = propertiesResult.headerSpecs;

	const blobRows = await db
		.select({
			sha: blobTable.sha256,
			size: blobTable.size,
			r2Key: blobTable.r2Key,
		})
		.from(blobTable)
		.innerJoin(
			accountBlobTable,
			and(eq(accountBlobTable.sha256, blobTable.sha256), eq(accountBlobTable.accountId, effectiveAccountId))
		)
		.where(inArray(blobTable.sha256, blobIds));
	const blobMap = new Map<string, { size: number | null; r2Key: string | null }>();
	for (const row of blobRows) {
		blobMap.set(row.sha, { size: row.size, r2Key: row.r2Key });
	}

	const parsed: Record<string, Record<string, unknown>> = {};
	const notParsable: string[] = [];
	const notFound: string[] = [];

	for (const blobId of blobIds) {
		const meta = blobMap.get(blobId);
		if (!meta) {
			if (allowMissingIds) {
				notFound.push(blobId);
			} else {
				notParsable.push(blobId);
			}
			continue;
		}

		try {
			const object = await c.env.R2_EMAILS.get(meta.r2Key ?? blobId);
			if (!object || !object.body) {
				if (allowMissingIds) {
					notFound.push(blobId);
				} else {
					notParsable.push(blobId);
				}
				continue;
			}
			const rawBuffer = await object.arrayBuffer();
			const parsedEmail = await parseRawEmail(rawBuffer);
			const snippet = makeSnippet(parsedEmail.email);
			const sentAt = parseSentAt(parsedEmail.email);
			const { structure } = await buildBodyStructure(parsedEmail, rawBuffer.byteLength);

			const emailRecord = buildEmailParseResult({
				blobId,
				metaSize: meta.size,
				parsedEmail,
				structure,
				snippet,
				sentAt,
				rawSize: rawBuffer.byteLength,
				maxBodyValueBytes,
				headerSpecs,
				bodyPropertySet,
				includeBodyStructure,
				includeTextBody,
				includeHtmlBody,
				includeBodyValuesProp,
				fetchTextBodyValues,
				fetchHTMLBodyValues,
				fetchAllBodyValues,
				shouldReturnBodyValues,
				shouldInclude,
			});

			parsed[blobId] = emailRecord;
		} catch (err) {
			console.warn("Failed to parse blob for Email/parse", err);
			notParsable.push(blobId);
		}
	}

	return [
		"Email/parse",
		{
			accountId: effectiveAccountId,
			parsed,
			notParsable,
			notFound,
		},
		tag,
	];
}

function parseEmailParseProperties(
	properties: string[] | undefined
):
	| { properties: Set<string> | null; headerSpecs: Map<string, HeaderSpec> }
	| { error: string } {
	if (properties === undefined) {
		return { properties: null, headerSpecs: new Map() };
	}
	const propertySet = new Set<string>();
	const headerSpecs = new Map<string, HeaderSpec>();
	for (const prop of properties) {
		if (typeof prop !== "string" || prop.length === 0) {
			return { error: "properties must be non-empty strings" };
		}
		if (prop.startsWith("header:")) {
			const spec = parseHeaderProperty(prop);
			if (!spec) {
				return { error: `Invalid header property ${prop}` };
			}
			propertySet.add(prop);
			headerSpecs.set(prop, spec);
			continue;
		}
		if (!EMAIL_PARSE_ALLOWED_PROPERTIES.has(prop)) {
			return { error: `Unsupported property ${prop}` };
		}
		propertySet.add(prop);
	}
	return { properties: propertySet, headerSpecs };
}

function normalizeMaxBodyValueBytes(value: number | undefined): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		return DEFAULT_MAX_BODY_VALUE_BYTES;
	}
	return Math.floor(value);
}

type BuildEmailParseResultOpts = {
	blobId: string;
	metaSize: number | null;
	parsedEmail: Awaited<ReturnType<typeof parseRawEmail>>;
	structure: StoredBodyPart;
	snippet: string | null;
	sentAt: Date | null;
	rawSize: number;
	maxBodyValueBytes: number;
	headerSpecs: Map<string, HeaderSpec>;
	bodyPropertySet: Set<string>;
	includeBodyStructure: boolean;
	includeTextBody: boolean;
	includeHtmlBody: boolean;
	includeBodyValuesProp: boolean;
	fetchTextBodyValues: boolean;
	fetchHTMLBodyValues: boolean;
	fetchAllBodyValues: boolean;
	shouldReturnBodyValues: boolean;
	shouldInclude: (prop: string) => boolean;
};

function buildEmailParseResult(opts: BuildEmailParseResultOpts): Record<string, unknown> {
	const {
		blobId,
		metaSize,
		parsedEmail,
		structure,
		snippet,
		sentAt,
		rawSize,
		maxBodyValueBytes,
		headerSpecs,
		bodyPropertySet,
		includeBodyStructure,
		includeTextBody,
		includeHtmlBody,
		includeBodyValuesProp,
		fetchTextBodyValues,
		fetchHTMLBodyValues,
		fetchAllBodyValues,
		shouldReturnBodyValues,
		shouldInclude,
	} = opts;

	const email: Record<string, unknown> = {};
	const message = parsedEmail.email;
	const resolvedStructure = structure ?? null;
	let attachmentList: AttachmentRecord[] | null = null;
	const getAttachments = () => {
		if (attachmentList === null) {
			attachmentList = collectAttachmentsFromStructure(resolvedStructure);
		}
		return attachmentList;
	};

	if (shouldInclude("blobId")) email.blobId = blobId;
	if (shouldInclude("size")) email.size = metaSize ?? rawSize;
	if (shouldInclude("subject")) email.subject = message.subject ?? null;
	if (shouldInclude("messageId")) email.messageId = normalizeMessageId(message.messageId ?? null);
	if (shouldInclude("inReplyTo")) email.inReplyTo = normalizeMessageId(message.inReplyTo ?? null);
	if (shouldInclude("references")) email.references = parseReferences(message.references ?? null);
	if (shouldInclude("sentAt")) email.sentAt = sentAt ? sentAt.toISOString() : null;
	if (shouldInclude("receivedAt")) email.receivedAt = null;
	if (shouldInclude("preview")) email.preview = snippet;
	if (shouldInclude("hasAttachment")) email.hasAttachment = getAttachments().length > 0;
	if (shouldInclude("keywords")) email.keywords = {};
	if (shouldInclude("mailboxIds")) email.mailboxIds = {};
	if (shouldInclude("threadId")) email.threadId = null;

	assignAddressField(email, "from", message.from, shouldInclude);
	assignAddressField(email, "to", message.to, shouldInclude);
	assignAddressField(email, "cc", message.cc, shouldInclude);
	assignAddressField(email, "bcc", message.bcc, shouldInclude);
	assignAddressField(email, "replyTo", message.replyTo, shouldInclude);
	assignAddressField(email, "sender", message.sender, shouldInclude);

	if (headerSpecs.size > 0) {
		const headerMap = buildHeaderValueMap(message.headers ?? []);
		for (const [prop, spec] of headerSpecs.entries()) {
			const values = headerMap.get(spec.lowerName);
			email[prop] = formatHeaderValues(values, spec.mode);
		}
	}

	if (includeBodyStructure) {
		email.bodyStructure = resolvedStructure ? filterBodyPart(resolvedStructure, bodyPropertySet) : null;
	}

	if (shouldInclude("attachments")) {
		email.attachments = getAttachments();
	}

	if (includeTextBody) {
		const textParts = collectBodyParts(resolvedStructure, (part) => part.type === "text" && part.subtype === "plain");
		email.textBody = textParts.map((part) => filterBodyPart(part, bodyPropertySet));
	}

	if (includeHtmlBody) {
		const htmlParts = collectBodyParts(resolvedStructure, (part) => part.type === "text" && part.subtype === "html");
		email.htmlBody = htmlParts.map((part) => filterBodyPart(part, bodyPropertySet));
	}

	if (shouldReturnBodyValues) {
		const includeTextValues = fetchAllBodyValues || fetchTextBodyValues || includeBodyValuesProp;
		const includeHtmlValues = fetchAllBodyValues || fetchHTMLBodyValues || includeBodyValuesProp;
		const bodyValues = buildBodyValuesFromMimeTree({
			mimeTree: parsedEmail.mimeTree,
			structure: resolvedStructure,
			includeText: includeTextValues,
			includeHtml: includeHtmlValues,
			maxBytes: maxBodyValueBytes,
		});
		if (Object.keys(bodyValues).length > 0) {
			email.bodyValues = bodyValues;
		}
	}

	return email;
}

function assignAddressField(
	email: Record<string, unknown>,
	key: string,
	value: ParsedAddress | ParsedAddress[] | undefined,
	shouldInclude: (prop: string) => boolean
): void {
	if (!shouldInclude(key)) return;
	email[key] = convertAddressList(value);
}

function buildHeaderValueMap(
	headers: { key: string; value: string }[]
): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const header of headers) {
		if (!header.key) continue;
		const lower = header.key.toLowerCase();
		const list = map.get(lower) ?? [];
		list.push(header.value);
		map.set(lower, list);
	}
	return map;
}

function convertAddressList(value: ParsedAddress | ParsedAddress[] | undefined): JmapEmailAddress[] {
	const result: JmapEmailAddress[] = [];
	if (!value) {
		return result;
	}
	const entries = Array.isArray(value) ? value : [value];
	for (const entry of entries) {
		appendAddressEntry(entry, result);
	}
	return result;
}

function appendAddressEntry(entry: ParsedAddress, target: JmapEmailAddress[]): void {
	if ("group" in entry && Array.isArray(entry.group)) {
		for (const mailbox of entry.group) {
			if (typeof mailbox.address === "string" && mailbox.address.length > 0) {
				target.push({
					email: mailbox.address,
					name: mailbox.name ?? null,
				});
			}
		}
		return;
	}
	if ("address" in entry && typeof entry.address === "string" && entry.address.length > 0) {
		target.push({
			email: entry.address,
			name: entry.name ?? null,
		});
	}
}

function buildBodyValuesFromMimeTree(params: {
	mimeTree: unknown;
	structure: StoredBodyPart | null;
	includeText: boolean;
	includeHtml: boolean;
	maxBytes: number;
}): Record<string, BodyValueRecord> {
	const { mimeTree, structure, includeText, includeHtml, maxBytes } = params;
	if (!structure) return {};

	const requested = new Map<string, StoredBodyPart>();
	if (includeText) {
		for (const part of collectBodyParts(structure, (entry) => entry.type === "text" && entry.subtype === "plain")) {
			requested.set(part.partId, part);
		}
	}
	if (includeHtml) {
		for (const part of collectBodyParts(structure, (entry) => entry.type === "text" && entry.subtype === "html")) {
			requested.set(part.partId, part);
		}
	}

	if (!requested.size) {
		return {};
	}

	const needed = new Set(requested.keys());
	const collected = new Map<string, string>();
	collectMimeTextParts(mimeTree, needed, collected, null, 0);

	const values: Record<string, BodyValueRecord> = {};
	for (const [partId, part] of requested.entries()) {
		const content = collected.get(partId);
		if (!content) continue;
		const { value, isTruncated } = truncateStringToBytes(content, maxBytes);
		values[partId] = {
			value,
			isTruncated,
			charset: part.charset ?? "UTF-8",
		};
	}
	return values;
}
