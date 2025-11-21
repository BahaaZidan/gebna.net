import { v } from "@gebna/validation";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";

import { getDB } from "./db";
import { accountBlobTable, blobTable, jmapStateTable } from "./db/schema";
import {
	JMAP_BLOB,
	JMAP_BLOB_ACCOUNT_CAPABILITY,
	JMAP_CONSTRAINTS,
	JMAP_CORE,
	JMAP_MAIL,
	JMAP_SUBMISSION,
	JMAP_VACATION,
} from "./lib/jmap/constants";
import { handleEmailChanges } from "./lib/jmap/method-handlers/email-changes";
import { handleEmailGet } from "./lib/jmap/method-handlers/email-get";
import { handleEmailQuery } from "./lib/jmap/method-handlers/email-query";
import { handleEmailQueryChanges } from "./lib/jmap/method-handlers/email-query-changes";
import { handleEmailSet } from "./lib/jmap/method-handlers/email-set";
import { handleEmailCopy } from "./lib/jmap/method-handlers/email-copy";
import { handleEmailImport } from "./lib/jmap/method-handlers/email-import";
import { handleEmailSubmissionSet } from "./lib/jmap/method-handlers/email-submission-set";
import { handleEmailSubmissionGet } from "./lib/jmap/method-handlers/email-submission-get";
import { handleEmailSubmissionChanges } from "./lib/jmap/method-handlers/email-submission-changes";
import { handleIdentityGet } from "./lib/jmap/method-handlers/identity-get";
import { handleIdentitySet } from "./lib/jmap/method-handlers/identity-set";
import { handleMailboxChanges } from "./lib/jmap/method-handlers/mailbox-changes";
import { handleMailboxGet } from "./lib/jmap/method-handlers/mailbox-get";
import { handleMailboxQuery } from "./lib/jmap/method-handlers/mailbox-query";
import { handleThreadChanges } from "./lib/jmap/method-handlers/thread-changes";
import { handleThreadGet } from "./lib/jmap/method-handlers/thread-get";
import { handleVacationResponseGet } from "./lib/jmap/method-handlers/vacation-get";
import { handleVacationResponseSet } from "./lib/jmap/method-handlers/vacation-set";
import { attachUserFromJwt, requireJWT, type JMAPHonoAppEnv } from "./lib/jmap/middlewares";
import { JmapHandlerResult, JmapMethodResponse } from "./lib/jmap/types";
import { handleMailboxSet } from "./lib/jmap/method-handlers/mailbox-set";
import { handleBlobCopy, handleBlobGet, handleBlobLookup } from "./lib/jmap/method-handlers/blob";
import { sha256HexFromArrayBuffer } from "./lib/utils";

const SUPPORTED_CAPABILITIES = new Set([
	JMAP_CORE,
	JMAP_MAIL,
	JMAP_SUBMISSION,
	JMAP_VACATION,
	JMAP_BLOB,
]);

const JmapMethodCallSchema = v.tuple([
	v.string(), // name
	v.record(v.string(), v.unknown()), // args
	v.string(), // tag
]);

const JmapRequestSchema = v.object({
	using: v.array(v.string()),
	methodCalls: v.array(JmapMethodCallSchema),
});

type JmapRequest = v.InferOutput<typeof JmapRequestSchema>;

type JmapHandler = (
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
) => Promise<JmapHandlerResult>;

async function getGlobalAccountState(
	db: ReturnType<typeof getDB>,
	accountId: string
): Promise<string> {
	const rows = await db
		.select({ modSeq: jmapStateTable.modSeq })
		.from(jmapStateTable)
		.where(eq(jmapStateTable.accountId, accountId));

	if (!rows.length) return "0";
	const max = rows.reduce((m, r) => (r.modSeq > m ? r.modSeq : m), rows[0]!.modSeq);
	return String(max);
}

async function handleSession(c: Context<JMAPHonoAppEnv>) {
	const user = c.get("user");
	const userId = user.id;
	const accountId = c.get("accountId");
	const db = getDB(c.env);

	const globalState = await getGlobalAccountState(db, accountId);

	const session = {
		capabilities: JMAP_CONSTRAINTS,
		accounts: {
			[accountId]: {
				name: "Gebna Mail",
				isPersonal: true,
				isReadOnly: false,
				accountCapabilities: {
					[JMAP_CORE]: {},
					[JMAP_MAIL]: {},
					[JMAP_SUBMISSION]: {},
					[JMAP_VACATION]: {},
					[JMAP_BLOB]: JMAP_BLOB_ACCOUNT_CAPABILITY,
				},
			},
		},
		primaryAccounts: {
			[JMAP_CORE]: accountId,
			[JMAP_MAIL]: accountId,
			[JMAP_SUBMISSION]: accountId,
			[JMAP_VACATION]: accountId,
			[JMAP_BLOB]: accountId,
		},
		username: userId,
		apiUrl: c.env.BASE_API_URL,
		downloadUrl: `${c.env.BASE_API_URL}${c.env.JMAP_DOWNLOAD_PATH}`,
		uploadUrl: `${c.env.BASE_API_URL}${c.env.JMAP_UPLOAD_PATH}`,
		eventSourceUrl: `${c.env.BASE_API_URL}/jmap/event-source/{accountId}`,
		state: globalState,
	};

	return c.json(session);
}

const methodHandlers: Record<string, JmapHandler> = {
	"Email/get": handleEmailGet,
	"Email/query": handleEmailQuery,
	"Email/queryChanges": handleEmailQueryChanges,
	"Email/copy": handleEmailCopy,
	"Email/import": handleEmailImport,
	"Email/changes": handleEmailChanges,
	"Thread/get": handleThreadGet,
	"Thread/changes": handleThreadChanges,
	"Mailbox/get": handleMailboxGet,
	"Mailbox/query": handleMailboxQuery,
	"Mailbox/changes": handleMailboxChanges,
	"Mailbox/set": handleMailboxSet,
	"Email/set": handleEmailSet,
	"EmailSubmission/set": handleEmailSubmissionSet,
	"EmailSubmission/get": handleEmailSubmissionGet,
	"EmailSubmission/changes": handleEmailSubmissionChanges,
	"Identity/get": handleIdentityGet,
	"Identity/set": handleIdentitySet,
	"VacationResponse/get": handleVacationResponseGet,
	"VacationResponse/set": handleVacationResponseSet,
	"Blob/get": handleBlobGet,
	"Blob/copy": handleBlobCopy,
	"Blob/lookup": handleBlobLookup,
};

async function handleJmap(c: Context<JMAPHonoAppEnv>) {
	const body = await c.req.json();
	const parsed = v.safeParse(JmapRequestSchema, body);

	if (!parsed.success) {
		return c.json({ type: "invalidArguments", errors: parsed.issues }, 400);
	}

	const req: JmapRequest = parsed.output;
	const unknownCapability = req.using.find((capability) => !SUPPORTED_CAPABILITIES.has(capability));
	if (unknownCapability) {
		return c.json(
			{
				type: "unknownCapability",
				capability: unknownCapability,
			},
			400
		);
	}

	const methodResponses: JmapMethodResponse[] = [];

	for (const [name, args, tag] of req.methodCalls) {
		try {
			const handler = methodHandlers[name];
			if (!handler) {
				methodResponses.push(["error", { type: "unknownMethod", description: name }, tag]);
				continue;
			}

			const resp = await handler(c, args as Record<string, unknown>, tag);
			if (Array.isArray(resp[0])) {
				for (const nested of resp as JmapMethodResponse[]) {
					methodResponses.push(nested);
				}
			} else {
				methodResponses.push(resp as JmapMethodResponse);
			}
		} catch (err) {
			console.error("JMAP method error", name, err);
			methodResponses.push(["error", { type: "serverError" }, tag]);
		}
	}

	return c.json({ methodResponses });
}

async function handleBlobUploadHttp(c: Context<JMAPHonoAppEnv>): Promise<Response> {
	const accountIdParam = c.req.param("accountId");
	const effectiveAccountId = c.get("accountId");
	if (accountIdParam !== effectiveAccountId) {
		return c.json({ type: "forbidden", description: "Account access denied" }, 403);
	}

	const contentLengthHeader = c.req.header("Content-Length");
	const maxSize = JMAP_CONSTRAINTS[JMAP_CORE].maxSizeUpload;
	if (contentLengthHeader) {
		const parsed = Number(contentLengthHeader);
		if (!Number.isFinite(parsed) || parsed < 0) {
			return c.json({ type: "invalidArguments", description: "Invalid Content-Length" }, 400);
		}
		if (maxSize && parsed > maxSize) {
			return c.json({ type: "invalidArguments", description: "Upload too large" }, 413);
		}
	}

	const body = await c.req.arrayBuffer();
	if (!body.byteLength) {
		return c.json({ type: "invalidArguments", description: "Empty upload" }, 400);
	}
	if (maxSize && body.byteLength > maxSize) {
		return c.json({ type: "invalidArguments", description: "Upload too large" }, 413);
	}

	const contentType = c.req.header("Content-Type") ?? "application/octet-stream";
	const blobId = await sha256HexFromArrayBuffer(body);
	const key = blobId;
	await c.env.R2_EMAILS.put(key, body, {
		httpMetadata: {
			contentType,
		},
	});

	const db = getDB(c.env);
	const now = new Date();
	await db.transaction(async (tx) => {
		await tx
			.insert(blobTable)
			.values({ sha256: blobId, size: body.byteLength, r2Key: key, createdAt: now })
			.onConflictDoUpdate({
				target: blobTable.sha256,
				set: { size: body.byteLength, r2Key: key, createdAt: now },
			});
		await tx
			.insert(accountBlobTable)
			.values({ accountId: effectiveAccountId, sha256: blobId, createdAt: now })
			.onConflictDoNothing({ target: [accountBlobTable.accountId, accountBlobTable.sha256] });
	});

	return c.json(
		{
			accountId: effectiveAccountId,
			blobId,
			type: contentType,
			size: body.byteLength,
		},
		201
	);
}

async function handleBlobDownloadHttp(c: Context<JMAPHonoAppEnv>): Promise<Response> {
	const params = c.req.param();
	const requestedAccountId = params.accountId;
	const effectiveAccountId = c.get("accountId");
	if (requestedAccountId !== effectiveAccountId) {
		return c.json({ type: "forbidden", description: "Account access denied" }, 403);
	}

	const blobId = params.blobId;
	const requestedName = decodeURIComponent(params.name ?? "blob");
	const typeParam = c.req.query("type");
	if (!typeParam) {
		return c.json({ type: "invalidArguments", description: "type query param required" }, 400);
	}
	const decodedType = decodeURIComponent(typeParam);
	const safeType = sanitizeMimeType(decodedType);
	if (!safeType) {
		return c.json({ type: "invalidArguments", description: "Invalid content type" }, 400);
	}

	const safeName = sanitizeFileName(requestedName);
	const db = getDB(c.env);
	const [row] = await db
		.select({ size: blobTable.size, r2Key: blobTable.r2Key })
		.from(accountBlobTable)
		.innerJoin(blobTable, eq(blobTable.sha256, accountBlobTable.sha256))
		.where(and(eq(accountBlobTable.accountId, effectiveAccountId), eq(accountBlobTable.sha256, blobId)))
		.limit(1);

	if (!row) {
		return c.json({ type: "notFound", description: "Blob not found" }, 404);
	}

	const object = await c.env.R2_EMAILS.get(row.r2Key ?? blobId);
	if (!object || !object.body) {
		return c.json({ type: "notFound", description: "Blob not found" }, 404);
	}

	const etag = `"${blobId}"`;
	const ifNoneMatch = c.req.header("If-None-Match");
	if (ifNoneMatch && ifNoneMatch.split(",").map((v) => v.trim()).includes(etag)) {
		return new Response(null, {
			status: 304,
			headers: {
				ETag: etag,
				"Cache-Control": "private, immutable, max-age=31536000",
			},
		});
	}

	const headers: Record<string, string> = {
		"Content-Type": safeType,
		ETag: etag,
		"Cache-Control": "private, immutable, max-age=31536000",
		"X-Content-Type-Options": "nosniff",
		"Content-Disposition": `attachment; filename="${encodeURIComponent(
			safeName
		)}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
	};
	if (row.size !== null && row.size !== undefined) {
		headers["Content-Length"] = String(row.size);
	}
	if (object.uploaded) {
		headers["Last-Modified"] = object.uploaded.toUTCString();
	}

	return new Response(object.body, { status: 200, headers });
}

function sanitizeMimeType(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (!/^[0-9A-Za-z!#$&^_.+-]+\/[0-9A-Za-z!#$&^_.+-]+$/.test(trimmed)) {
		return null;
	}
	return trimmed;
}

function sanitizeFileName(value: string): string {
	return value.replace(/\r|\n/g, "").replace(/"/g, "");
}

async function handleEventSource(c: Context<JMAPHonoAppEnv>): Promise<Response> {
	const accountIdParam = c.req.param("accountId");
	const effectiveAccountId = c.get("accountId");
	if (accountIdParam !== effectiveAccountId) {
		return c.json({ type: "forbidden", description: "Account access denied" }, 403);
	}

	const db = getDB(c.env);
	const snapshot = await db
		.select({ type: jmapStateTable.type, modSeq: jmapStateTable.modSeq })
		.from(jmapStateTable)
		.where(eq(jmapStateTable.accountId, effectiveAccountId));

	const changeMap: Record<string, string> = {};
	for (const row of snapshot) {
		changeMap[row.type] = String(row.modSeq);
	}

	const payload = JSON.stringify({ accountId: effectiveAccountId, changed: changeMap });
	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode(`event: state\ndata: ${payload}\n\n`));
			controller.close();
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-store",
			Connection: "keep-alive",
		},
	});
}

export const jmapApp = new Hono<JMAPHonoAppEnv>();

jmapApp.use(requireJWT);
jmapApp.use(attachUserFromJwt);

jmapApp.get("/.well-known/jmap", handleSession);
jmapApp.post("/jmap", handleJmap);
jmapApp.post("/jmap/upload/:accountId", handleBlobUploadHttp);
jmapApp.get("/jmap/download/:accountId/:blobId/:name", handleBlobDownloadHttp);
jmapApp.get("/jmap/event-source/:accountId", handleEventSource);
