import { and, eq, inArray } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import {
	accountBlobTable,
	accountMessageTable,
	attachmentTable,
	blobTable,
	messageTable,
} from "../../../db/schema";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess } from "../utils";

const ALLOWED_BLOB_PROPERTIES = new Set([
	"data",
	"data:asText",
	"data:asBase64",
	"size",
	"isEncodingProblem",
	"isTruncated",
]);

const SUPPORTED_DIGESTS = new Set(["sha-256"]);
const SUPPORTED_LOOKUP_TYPES = new Set(["Email"]);

export async function handleBlobGet(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);
	const effectiveAccountId = ensureAccountAccess(c, args.accountId as string | undefined);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const idsInput = args.ids;
	if (!Array.isArray(idsInput) || idsInput.length === 0) {
		return ["error", { type: "invalidArguments", description: "ids must be a non-empty array" }, tag];
	}
	const ids: string[] = [];
	for (const value of idsInput) {
		if (typeof value === "string" && value.length > 0) {
			ids.push(value);
		}
	}
	if (!ids.length) {
		return ["error", { type: "invalidArguments", description: "ids must include strings" }, tag];
	}

	const propertiesInput = args.properties;
	let requestedProps: string[] = ["data", "size"];
	if (propertiesInput !== undefined) {
		if (!Array.isArray(propertiesInput)) {
			return ["error", { type: "invalidArguments", description: "properties must be an array" }, tag];
		}
		const props: string[] = [];
		for (const prop of propertiesInput) {
			if (typeof prop !== "string" || prop.length === 0) {
				return ["error", { type: "invalidArguments", description: "properties must be strings" }, tag];
			}
			props.push(prop);
		}
		if (props.length > 0) {
			requestedProps = props;
		}
	}

	const offsetValue = args.offset;
	let offset = 0;
	if (offsetValue !== undefined) {
		if (typeof offsetValue !== "number" || !Number.isFinite(offsetValue) || offsetValue < 0) {
			return [
				"error",
				{ type: "invalidArguments", description: "offset must be a positive number" },
				tag,
			];
		}
		offset = Math.floor(offsetValue);
	}

	const lengthValue = args.length;
	let length: number | null = null;
	if (lengthValue !== undefined) {
		if (typeof lengthValue !== "number" || !Number.isFinite(lengthValue) || lengthValue < 0) {
			return [
				"error",
				{ type: "invalidArguments", description: "length must be a positive number" },
				tag,
			];
		}
		length = Math.floor(lengthValue);
	}

	const autoData = new Set(requestedProps);
	const wantsAutoData = autoData.has("data");
	const wantsText = autoData.has("data:asText");
	const wantsBase64 = autoData.has("data:asBase64");

	const digestProps = requestedProps
		.filter((prop) => prop.startsWith("digest:"))
		.map((prop) => prop.slice("digest:".length));
	for (const digest of digestProps) {
		if (!SUPPORTED_DIGESTS.has(digest.toLowerCase())) {
			return ["error", { type: "invalidArguments", description: `Unsupported digest ${digest}` }, tag];
		}
	}

	for (const prop of requestedProps) {
		if (prop.startsWith("digest:")) continue;
		if (!ALLOWED_BLOB_PROPERTIES.has(prop)) {
			return ["error", { type: "invalidArguments", description: `Invalid property ${prop}` }, tag];
		}
	}

	const rows = await db
		.select({
			id: accountBlobTable.sha256,
			size: blobTable.size,
			r2Key: blobTable.r2Key,
		})
		.from(accountBlobTable)
		.innerJoin(blobTable, eq(accountBlobTable.sha256, blobTable.sha256))
		.where(and(eq(accountBlobTable.accountId, effectiveAccountId), inArray(accountBlobTable.sha256, ids)));

	const blobMap = new Map<string, { size: number; r2Key: string | null }>();
	for (const row of rows) {
		blobMap.set(row.id, { size: row.size ?? 0, r2Key: row.r2Key });
	}

	const notFound: string[] = [];
	const list: Record<string, unknown>[] = [];

	for (const id of ids) {
		const meta = blobMap.get(id);
		if (!meta) {
			notFound.push(id);
			continue;
		}

		const entry: Record<string, unknown> = {
			id,
			size: meta.size,
			isEncodingProblem: false,
			isTruncated: false,
		};

		const needsData =
			wantsAutoData || wantsText || wantsBase64 || digestProps.length > 0 || offset > 0 || length !== null;

		let dataView: Uint8Array<ArrayBufferLike> | null = null;
		if (needsData) {
			const object = await c.env.R2_EMAILS.get(meta.r2Key ?? id);
			if (!object || !object.body) {
				notFound.push(id);
				continue;
			}
			const buffer = await object.arrayBuffer();
			dataView = new Uint8Array(buffer);
		}

		let slice: Uint8Array<ArrayBufferLike> = new Uint8Array();
		if (dataView) {
			const safeOffset = Math.min(offset, meta.size);
			const maxLength = length === null ? meta.size - safeOffset : length;
			const safeLength = Math.max(0, Math.min(meta.size - safeOffset, maxLength));
			const end = safeOffset + safeLength;
			if (safeOffset >= meta.size) {
				entry.isTruncated = true;
			}
			if (length !== null && safeOffset + length < meta.size) {
				entry.isTruncated = true;
			}
			slice = dataView.subarray(safeOffset, end);
		}

		let textValue: string | null = null;
		let encodingProblem = false;
		if (slice.length > 0 || offset < meta.size) {
			if (slice.length > 0) {
				try {
					textValue = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(slice);
				} catch {
					encodingProblem = true;
					textValue = null;
				}
			}
		} else if (needsData) {
			textValue = "";
		}

		if (encodingProblem) {
			entry.isEncodingProblem = true;
		}

		const shouldEmitText = wantsText || (wantsAutoData && textValue !== null && !encodingProblem);
		const shouldEmitBase64 =
			wantsBase64 ||
			(wantsAutoData && (!shouldEmitText || textValue === null || encodingProblem));

		if (shouldEmitText) {
			entry["data:asText"] = textValue ?? null;
		}

		if (shouldEmitBase64 && slice.length > 0) {
			entry["data:asBase64"] = encodeBase64(slice);
		} else if (shouldEmitBase64) {
			entry["data:asBase64"] = "";
		}

		for (const digest of digestProps) {
			if (!slice.length) {
				entry[`digest:${digest}`] = encodeBase64(new Uint8Array());
				continue;
			}
			const value = await crypto.subtle.digest(digest.toUpperCase(), slice);
			entry[`digest:${digest}`] = encodeBase64(new Uint8Array(value));
		}

		list.push(entry);
	}

	return [
		"Blob/get",
		{
			accountId: effectiveAccountId,
			list,
			notFound,
		},
		tag,
	];
}

export async function handleBlobCopy(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);
	const effectiveAccountId = ensureAccountAccess(c, args.accountId as string | undefined);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const fromAccountId = (args.fromAccountId as string | undefined) ?? effectiveAccountId;
	if (fromAccountId !== effectiveAccountId) {
		return ["error", { type: "fromAccountNotFound" }, tag];
	}

	const blobIdsInput = args.blobIds;
	if (!Array.isArray(blobIdsInput) || blobIdsInput.length === 0) {
		return ["error", { type: "invalidArguments", description: "blobIds must be provided" }, tag];
	}

	const blobIds: string[] = [];
	for (const value of blobIdsInput) {
		if (typeof value === "string" && value.length > 0) {
			blobIds.push(value);
		}
	}

	if (!blobIds.length) {
		return ["error", { type: "invalidArguments", description: "blobIds must be strings" }, tag];
	}

	const rows = await db
		.select({ sha: accountBlobTable.sha256 })
		.from(accountBlobTable)
		.where(and(eq(accountBlobTable.accountId, effectiveAccountId), inArray(accountBlobTable.sha256, blobIds)));

	const accessible = new Set(rows.map((row) => row.sha));
	const copied: Record<string, string> = {};
	const notCopied: Record<string, { type: string; description?: string }> = {};

	for (const blobId of blobIds) {
		if (!accessible.has(blobId)) {
			notCopied[blobId] = { type: "notFound" };
			continue;
		}
		copied[blobId] = blobId;
	}

	return [
		"Blob/copy",
		{
			fromAccountId,
			accountId: effectiveAccountId,
			copied: Object.keys(copied).length ? copied : null,
			notCopied: Object.keys(notCopied).length ? notCopied : null,
		},
		tag,
	];
}

export async function handleBlobLookup(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);
	const effectiveAccountId = ensureAccountAccess(c, args.accountId as string | undefined);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const idsInput = args.ids;
	if (!Array.isArray(idsInput) || idsInput.length === 0) {
		return ["error", { type: "invalidArguments", description: "ids must be provided" }, tag];
	}
	const ids: string[] = [];
	for (const value of idsInput) {
		if (typeof value === "string" && value.length > 0) {
			ids.push(value);
		}
	}
	if (!ids.length) {
		return ["error", { type: "invalidArguments", description: "ids must include strings" }, tag];
	}

	const typeNamesInput = args.typeNames;
	if (!Array.isArray(typeNamesInput) || typeNamesInput.length === 0) {
		return ["error", { type: "invalidArguments", description: "typeNames must be provided" }, tag];
	}
	const typeNames: string[] = [];
	for (const value of typeNamesInput) {
		if (typeof value !== "string" || value.length === 0) {
			return ["error", { type: "invalidArguments", description: "typeNames must be strings" }, tag];
		}
		if (!SUPPORTED_LOOKUP_TYPES.has(value)) {
			return ["error", { type: "unknownDataType", description: value }, tag];
		}
		typeNames.push(value);
	}

	const rows = await db
		.select({ sha: accountBlobTable.sha256 })
		.from(accountBlobTable)
		.where(and(eq(accountBlobTable.accountId, effectiveAccountId), inArray(accountBlobTable.sha256, ids)));

	const accessible = new Set(rows.map((row) => row.sha));
	const notFound: string[] = [];
	const filteredIds = ids.filter((id) => {
		if (!accessible.has(id)) {
			notFound.push(id);
			return false;
		}
		return true;
	});

	const emailMatches = new Map<string, Set<string>>();

	if (typeNames.includes("Email") && filteredIds.length > 0) {
		const rawRows = await db
			.select({ blobId: messageTable.rawBlobSha256, emailId: accountMessageTable.id })
			.from(accountMessageTable)
			.innerJoin(messageTable, eq(accountMessageTable.messageId, messageTable.id))
			.where(
				and(
					eq(accountMessageTable.accountId, effectiveAccountId),
					inArray(messageTable.rawBlobSha256, filteredIds)
				)
			);

		for (const row of rawRows) {
			if (!row.blobId) continue;
			const list = emailMatches.get(row.blobId) ?? new Set<string>();
			list.add(row.emailId);
			emailMatches.set(row.blobId, list);
		}

		const attachmentRows = await db
			.select({ blobId: attachmentTable.blobSha256, emailId: accountMessageTable.id })
			.from(attachmentTable)
			.innerJoin(messageTable, eq(attachmentTable.messageId, messageTable.id))
			.innerJoin(accountMessageTable, eq(accountMessageTable.messageId, messageTable.id))
			.where(
				and(
					eq(accountMessageTable.accountId, effectiveAccountId),
					inArray(attachmentTable.blobSha256, filteredIds)
				)
			);

		for (const row of attachmentRows) {
			if (!row.blobId) continue;
			const list = emailMatches.get(row.blobId) ?? new Set<string>();
			list.add(row.emailId);
			emailMatches.set(row.blobId, list);
		}
	}

	const list = filteredIds.map((blobId) => {
		const matchedIds: Record<string, string[]> = {};
		if (typeNames.includes("Email")) {
			matchedIds.Email = Array.from(emailMatches.get(blobId) ?? []);
		}
		return { id: blobId, matchedIds };
	});

	return [
		"Blob/lookup",
		{
			list,
			notFound,
			accountId: effectiveAccountId,
		},
		tag,
	];
}

function encodeBase64(data: Uint8Array<ArrayBufferLike>): string {
	if (data.length === 0) return "";
	let binary = "";
	const chunkSize = 0x8000;
	for (let i = 0; i < data.length; i += chunkSize) {
		const chunk = data.subarray(i, i + chunkSize);
		binary += String.fromCharCode(...chunk);
	}
	return btoa(binary);
}
