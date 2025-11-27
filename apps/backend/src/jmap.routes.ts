import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";

import { getDB } from "./db";
import { accountBlobTable, blobTable, changeLogTable, jmapStateTable } from "./db/schema";
import {
	JMAP_BLOB,
	JMAP_BLOB_ACCOUNT_CAPABILITY,
	JMAP_CONSTRAINTS,
	JMAP_CORE,
	JMAP_MAIL,
	JMAP_PUSH,
	JMAP_SUBMISSION,
	JMAP_VACATION,
} from "./lib/jmap/constants";
import { handleBlobCopy, handleBlobGet, handleBlobLookup } from "./lib/jmap/method-handlers/blob";
import { handleEmailChanges } from "./lib/jmap/method-handlers/email-changes";
import { handleEmailCopy } from "./lib/jmap/method-handlers/email-copy";
import { handleEmailGet } from "./lib/jmap/method-handlers/email-get";
import { handleEmailImport } from "./lib/jmap/method-handlers/email-import";
import { handleEmailParse } from "./lib/jmap/method-handlers/email-parse";
import { handleEmailQuery } from "./lib/jmap/method-handlers/email-query";
import { handleEmailQueryChanges } from "./lib/jmap/method-handlers/email-query-changes";
import { handleEmailSet } from "./lib/jmap/method-handlers/email-set";
import { handleEmailSubmissionChanges } from "./lib/jmap/method-handlers/email-submission-changes";
import { handleEmailSubmissionGet } from "./lib/jmap/method-handlers/email-submission-get";
import { handleEmailSubmissionQuery } from "./lib/jmap/method-handlers/email-submission-query";
import { handleEmailSubmissionQueryChanges } from "./lib/jmap/method-handlers/email-submission-query-changes";
import { handleEmailSubmissionSet } from "./lib/jmap/method-handlers/email-submission-set";
import { handleIdentityChanges } from "./lib/jmap/method-handlers/identity-changes";
import { handleIdentityGet } from "./lib/jmap/method-handlers/identity-get";
import { handleIdentitySet } from "./lib/jmap/method-handlers/identity-set";
import { handleMailboxChanges } from "./lib/jmap/method-handlers/mailbox-changes";
import { handleMailboxGet } from "./lib/jmap/method-handlers/mailbox-get";
import { handleMailboxQuery } from "./lib/jmap/method-handlers/mailbox-query";
import { handleMailboxQueryChanges } from "./lib/jmap/method-handlers/mailbox-query-changes";
import { handleMailboxSet } from "./lib/jmap/method-handlers/mailbox-set";
import { handlePushSubscriptionGet } from "./lib/jmap/method-handlers/push-subscription-get";
import { handlePushSubscriptionSet } from "./lib/jmap/method-handlers/push-subscription-set";
import { handleThreadChanges } from "./lib/jmap/method-handlers/thread-changes";
import { handleThreadGet } from "./lib/jmap/method-handlers/thread-get";
import { handleVacationResponseGet } from "./lib/jmap/method-handlers/vacation-get";
import { handleVacationResponseSet } from "./lib/jmap/method-handlers/vacation-set";
import { attachUserFromJwt, requireJWT, type JMAPHonoAppEnv } from "./lib/jmap/middlewares";
import {
	CreationReferenceMap,
	JmapHandlerResult,
	JmapMethodResponse,
	JmapStateType,
} from "./lib/jmap/types";
import { sha256HexFromArrayBuffer } from "./lib/utils";

const SUPPORTED_CAPABILITIES = new Set([
	JMAP_CORE,
	JMAP_MAIL,
	JMAP_SUBMISSION,
	JMAP_VACATION,
	JMAP_BLOB,
	JMAP_PUSH,
]);

function buildMailAccountCapability(): Record<string, unknown> {
	return {
		...JMAP_CONSTRAINTS[JMAP_MAIL],
		mayCreateTopLevelMailbox: true,
	};
}

function buildSubmissionAccountCapability(env: CloudflareBindings): Record<string, unknown> {
	const maxDelayedSend = getUndoWindowSeconds(env);
	const submissionExtensions: Record<string, string[]> = {};
	return {
		maxDelayedSend: maxDelayedSend ?? 0,
		submissionExtensions,
	};
}

function buildVacationAccountCapability(): Record<string, unknown> {
	return {
		supportsRichText: true,
		supportsCalendarAutoReplies: true,
	};
}

type JmapMethodCall = [string, Record<string, unknown>, string];

type JmapRequest = {
	using: string[];
	methodCalls: JmapMethodCall[];
	createdIds?: Record<string, string>;
	extraProperties?: Record<string, unknown>;
};

type JmapHandler = (
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
) => Promise<JmapHandlerResult>;

function parseJmapRequest(
	body: unknown
): { success: true; value: JmapRequest } | { success: false; error: string } {
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		return { success: false, error: "Request body must be a JSON object" };
	}
	const record = body as Record<string, unknown>;
	const using = record.using;
	if (!Array.isArray(using) || using.some((entry) => typeof entry !== "string")) {
		return { success: false, error: "using must be an array of strings" };
	}
	const methodCalls = record.methodCalls;
	if (!Array.isArray(methodCalls)) {
		return { success: false, error: "methodCalls must be an array" };
	}
	const normalizedCalls: JmapMethodCall[] = [];
	for (const [index, call] of methodCalls.entries()) {
		if (!Array.isArray(call) || call.length !== 3) {
			return {
				success: false,
				error: `methodCalls[${index}] must be a tuple of [name, args, tag]`,
			};
		}
		const [name, args, tag] = call;
		if (typeof name !== "string" || typeof tag !== "string") {
			return { success: false, error: `methodCalls[${index}] must include string name and tag` };
		}
		if (!args || typeof args !== "object" || Array.isArray(args)) {
			return { success: false, error: `methodCalls[${index}] args must be an object` };
		}
		normalizedCalls.push([name, args as Record<string, unknown>, tag]);
	}
	let createdIds: Record<string, string> | undefined;
	if (record.createdIds !== undefined) {
		if (
			!record.createdIds ||
			typeof record.createdIds !== "object" ||
			Array.isArray(record.createdIds)
		) {
			return { success: false, error: "createdIds must be an object when present" };
		}
		const map: Record<string, string> = {};
		for (const [key, value] of Object.entries(record.createdIds)) {
			if (typeof value !== "string" || value.length === 0) {
				return { success: false, error: "createdIds values must be non-empty strings" };
			}
			map[key] = value;
		}
		createdIds = map;
	}
	const extraProperties: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(record)) {
		if (key === "using" || key === "methodCalls" || key === "createdIds") {
			continue;
		}
		extraProperties[key] = value;
	}

	return {
		success: true,
		value: { using, methodCalls: normalizedCalls, createdIds, extraProperties },
	};
}

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
					[JMAP_CORE]: { ...JMAP_CONSTRAINTS[JMAP_CORE] },
					[JMAP_MAIL]: buildMailAccountCapability(),
					[JMAP_SUBMISSION]: buildSubmissionAccountCapability(c.env),
					[JMAP_VACATION]: buildVacationAccountCapability(),
					[JMAP_BLOB]: JMAP_BLOB_ACCOUNT_CAPABILITY,
					[JMAP_PUSH]: {
						maxSubscriptionsPerAccount:
							JMAP_CONSTRAINTS[JMAP_PUSH]?.maxSubscriptionsPerAccount ?? 0,
					},
				},
			},
		},
		primaryAccounts: {
			[JMAP_CORE]: accountId,
			[JMAP_MAIL]: accountId,
			[JMAP_SUBMISSION]: accountId,
			[JMAP_VACATION]: accountId,
			[JMAP_BLOB]: accountId,
			[JMAP_PUSH]: accountId,
		},
		username: userId,
		apiUrl: `${c.env.BASE_API_URL}${c.env.JMAP_BASE_PATH ?? ""}`,
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
	"Email/parse": handleEmailParse,
	"Email/changes": handleEmailChanges,
	"Thread/get": handleThreadGet,
	"Thread/changes": handleThreadChanges,
	"Mailbox/get": handleMailboxGet,
	"Mailbox/query": handleMailboxQuery,
	"Mailbox/queryChanges": handleMailboxQueryChanges,
	"Mailbox/changes": handleMailboxChanges,
	"Mailbox/set": handleMailboxSet,
	"Email/set": handleEmailSet,
	"EmailSubmission/set": handleEmailSubmissionSet,
	"EmailSubmission/get": handleEmailSubmissionGet,
	"EmailSubmission/query": handleEmailSubmissionQuery,
	"EmailSubmission/queryChanges": handleEmailSubmissionQueryChanges,
	"EmailSubmission/changes": handleEmailSubmissionChanges,
	"Identity/get": handleIdentityGet,
	"Identity/changes": handleIdentityChanges,
	"Identity/set": handleIdentitySet,
	"PushSubscription/get": handlePushSubscriptionGet,
	"PushSubscription/set": handlePushSubscriptionSet,
	"VacationResponse/get": handleVacationResponseGet,
	"VacationResponse/set": handleVacationResponseSet,
	"Blob/get": handleBlobGet,
	"Blob/copy": handleBlobCopy,
	"Blob/lookup": handleBlobLookup,
};

const METHOD_CAPABILITIES: Record<string, string[]> = {
	"Email/get": [JMAP_MAIL],
	"Email/query": [JMAP_MAIL],
	"Email/queryChanges": [JMAP_MAIL],
	"Email/copy": [JMAP_MAIL],
	"Email/import": [JMAP_MAIL],
	"Email/parse": [JMAP_MAIL],
	"Email/changes": [JMAP_MAIL],
	"Email/set": [JMAP_MAIL],
	"Thread/get": [JMAP_MAIL],
	"Thread/changes": [JMAP_MAIL],
	"Mailbox/get": [JMAP_MAIL],
	"Mailbox/query": [JMAP_MAIL],
	"Mailbox/queryChanges": [JMAP_MAIL],
	"Mailbox/changes": [JMAP_MAIL],
	"Mailbox/set": [JMAP_MAIL],
	"EmailSubmission/set": [JMAP_SUBMISSION],
	"EmailSubmission/get": [JMAP_SUBMISSION],
	"EmailSubmission/query": [JMAP_SUBMISSION],
	"EmailSubmission/queryChanges": [JMAP_SUBMISSION],
	"EmailSubmission/changes": [JMAP_SUBMISSION],
	"Identity/get": [JMAP_SUBMISSION],
	"Identity/changes": [JMAP_SUBMISSION],
	"Identity/set": [JMAP_SUBMISSION],
	"PushSubscription/get": [JMAP_PUSH],
	"PushSubscription/set": [JMAP_PUSH],
	"VacationResponse/get": [JMAP_VACATION],
	"VacationResponse/set": [JMAP_VACATION],
	"Blob/get": [JMAP_BLOB],
	"Blob/copy": [JMAP_BLOB],
	"Blob/lookup": [JMAP_BLOB],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveStringReference(value: string, refs: CreationReferenceMap): string {
	if (value.startsWith("#") && value.length > 1) {
		const resolved = refs.get(value.slice(1));
		if (resolved) {
			return resolved;
		}
	}
	return value;
}

type ResultReferenceStore = Map<string, { name: string; payload: unknown }[]>;

class ResultReferenceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ResultReferenceError";
	}
}

type ResultReferenceObject = {
	resultOf: string;
	name: string;
	path: string;
};

function isResultReferenceObject(value: unknown): value is ResultReferenceObject {
	if (!isPlainObject(value)) return false;
	const keys = Object.keys(value);
	if (keys.length !== 3) return false;
	return (
		typeof value.resultOf === "string" &&
		typeof value.name === "string" &&
		typeof value.path === "string"
	);
}

function decodePointerToken(token: string): string {
	return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveJsonPointer(payload: unknown, pointer: string): unknown {
	if (pointer === "") {
		return payload;
	}
	if (!pointer.startsWith("/")) {
		throw new ResultReferenceError(`Invalid result reference path ${pointer}`);
	}
	const segments = pointer.split("/").slice(1).map(decodePointerToken);
	let current: unknown = payload;
	for (const segment of segments) {
		if (Array.isArray(current)) {
			const index = Number(segment);
			if (!Number.isFinite(index) || index < 0 || index >= current.length) {
				throw new ResultReferenceError(`Path segment ${segment} is out of bounds`);
			}
			current = current[index];
		} else if (isPlainObject(current)) {
			if (!Object.prototype.hasOwnProperty.call(current, segment)) {
				throw new ResultReferenceError(`Path segment ${segment} not found`);
			}
			current = (current as Record<string, unknown>)[segment];
		} else {
			throw new ResultReferenceError(`Cannot dereference path segment ${segment}`);
		}
	}
	return current;
}

function resolveResultReferenceObject(
	value: ResultReferenceObject,
	store: ResultReferenceStore
): unknown {
	const entries = store.get(value.resultOf);
	if (!entries) {
		throw new ResultReferenceError(`Unknown resultOf reference ${value.resultOf}`);
	}
	const entry = entries.find((item) => item.name === value.name);
	if (!entry) {
		throw new ResultReferenceError(
			`No response named ${value.name} for resultOf ${value.resultOf}`
		);
	}
	return resolveJsonPointer(entry.payload, value.path);
}

function cloneWithResultReferences<T>(
	value: T,
	refs: CreationReferenceMap,
	resultStore: ResultReferenceStore
): T {
	if (typeof value === "string") {
		return resolveStringReference(value, refs) as T;
	}
	if (isResultReferenceObject(value)) {
		const resolved = resolveResultReferenceObject(value, resultStore);
		return cloneWithResultReferences(resolved as T, refs, resultStore);
	}
	if (Array.isArray(value)) {
		return value.map((entry) => cloneWithResultReferences(entry, refs, resultStore)) as T;
	}
	if (isPlainObject(value)) {
		const next: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value)) {
			const resolvedKey = resolveStringReference(key, refs);
			next[resolvedKey] = cloneWithResultReferences(entry, refs, resultStore);
		}
		return next as T;
	}
	return value;
}

const SSE_DEFAULT_POLL_MS = 3000;
const ALL_EVENT_SOURCE_TYPES: readonly JmapStateType[] = [
	"Email",
	"Mailbox",
	"Thread",
	"Identity",
	"VacationResponse",
	"EmailSubmission",
	"PushSubscription",
];

function captureCreationReferences(response: JmapMethodResponse, refs: CreationReferenceMap): void {
	const payload = response[1];
	if (!isPlainObject(payload)) return;
	const created = payload.created;
	if (!isPlainObject(created)) return;

	for (const [creationId, record] of Object.entries(created)) {
		if (!isPlainObject(record)) continue;
		const objectId = record.id;
		if (typeof objectId === "string" && objectId.length > 0) {
			refs.set(creationId, objectId);
		}
	}
}

function captureResultReferencePayload(
	response: JmapMethodResponse,
	store: ResultReferenceStore
): void {
	const [methodName, payload, tag] = response;
	if (typeof tag !== "string" || !tag) return;
	const list = store.get(tag) ?? [];
	list.push({ name: methodName, payload });
	store.set(tag, list);
}

const requestTextEncoder = new TextEncoder();

async function handleJmap(c: Context<JMAPHonoAppEnv>) {
	const db = getDB(c.env);
	const accountId = c.get("accountId");
	const rawBody = await c.req.text();
	const maxSizeRequest = JMAP_CONSTRAINTS[JMAP_CORE].maxSizeRequest ?? null;
	if (maxSizeRequest) {
		const bodySize = requestTextEncoder.encode(rawBody).length;
		if (bodySize > maxSizeRequest) {
			return c.json(
				{ type: "requestTooLarge", description: "Request exceeds maxSizeRequest" },
				413
			);
		}
	}

	let body: unknown;
	try {
		body = rawBody ? JSON.parse(rawBody) : {};
	} catch {
		return c.json({ type: "invalidArguments", description: "Invalid JSON body" }, 400);
	}

	const parsed = parseJmapRequest(body);
	if (!parsed.success) {
		return c.json({ type: "invalidArguments", description: parsed.error }, 400);
	}

	const req = parsed.value;
	c.set("requestProperties", req.extraProperties ?? {});
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
	if (!req.using.includes(JMAP_CORE)) {
		return c.json(
			{
				type: "unknownCapability",
				capability: JMAP_CORE,
			},
			400
		);
	}

	const maxCalls = JMAP_CONSTRAINTS[JMAP_CORE].maxCallsInRequest ?? null;
	if (maxCalls && req.methodCalls.length > maxCalls) {
		return c.json(
			{
				type: "requestTooLarge",
				description: `methodCalls exceeds maxCallsInRequest (${maxCalls})`,
			},
			400
		);
	}

	const methodResponses: JmapMethodResponse[] = [];
	const shouldReturnCreatedIds = req.createdIds !== undefined;
	const creationReferences: CreationReferenceMap = new Map();
	if (req.createdIds) {
		for (const [creationId, recordId] of Object.entries(req.createdIds)) {
			if (typeof recordId === "string" && recordId.length > 0) {
				creationReferences.set(creationId, recordId);
			}
		}
	}
	c.set("creationReferences", creationReferences);
	const resultReferenceStore: ResultReferenceStore = new Map();
	const requestedCapabilities = new Set(req.using);

	for (const [name, args, tag] of req.methodCalls) {
		try {
			const handler = methodHandlers[name];
			if (!handler) {
				methodResponses.push(["error", { type: "unknownMethod", description: name }, tag]);
				continue;
			}

			const requiredCapabilities = METHOD_CAPABILITIES[name] ?? [];
			const missingCapability = requiredCapabilities.find(
				(capability) => !requestedCapabilities.has(capability)
			);
			if (missingCapability) {
				methodResponses.push([
					"error",
					{ type: "unknownCapability", capability: missingCapability },
					tag,
				]);
				continue;
			}

			let resolvedArgs: Record<string, unknown>;
			try {
				resolvedArgs = cloneWithResultReferences(
					args as Record<string, unknown>,
					creationReferences,
					resultReferenceStore
				);
			} catch (err) {
				if (err instanceof ResultReferenceError) {
					methodResponses.push([
						"error",
						{ type: "invalidResultReference", description: err.message },
						tag,
					]);
					continue;
				}
				throw err;
			}
			const resp = await handler(c, resolvedArgs, tag);
			if (Array.isArray(resp[0])) {
				for (const nested of resp as JmapMethodResponse[]) {
					methodResponses.push(nested);
					captureCreationReferences(nested, creationReferences);
					captureResultReferencePayload(nested, resultReferenceStore);
				}
			} else {
				const single = resp as JmapMethodResponse;
				methodResponses.push(single);
				captureCreationReferences(single, creationReferences);
				captureResultReferencePayload(single, resultReferenceStore);
			}
		} catch (err) {
			console.error("JMAP method error", name, err);
			methodResponses.push(["error", { type: "serverError" }, tag]);
		}
	}

	const sessionState = await getGlobalAccountState(db, accountId);
	const responseBody: Record<string, unknown> = {
		sessionState,
		methodResponses,
	};
	if (shouldReturnCreatedIds) {
		responseBody.createdIds = Object.fromEntries(creationReferences);
	}
	return c.json(responseBody);
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

	const db = getDB(c.env);
	const now = new Date();
	const contentTypeHeader = c.req.header("Content-Type") ?? "application/octet-stream";
	const blobId = await sha256HexFromArrayBuffer(body);
	const sanitizedHeaderType =
		sanitizeMimeType(contentTypeHeader.split(";")[0] ?? contentTypeHeader) ??
		"application/octet-stream";
	const typeQuery = c.req.query("type");
	const requestedType = typeQuery ? sanitizeMimeType(typeQuery) : null;
	const storedContentType = requestedType ?? sanitizedHeaderType;
	const requestedName = c.req.query("name");
	const storedName =
		typeof requestedName === "string" && requestedName.length > 0
			? sanitizeFileName(requestedName)
			: null;

	const accountHasBlob = await db
		.select({ sha256: accountBlobTable.sha256 })
		.from(accountBlobTable)
		.where(
			and(eq(accountBlobTable.accountId, effectiveAccountId), eq(accountBlobTable.sha256, blobId))
		)
		.limit(1);

	if (!accountHasBlob.length) {
		const accountLimit = parseAccountUploadLimit(c.env);
		if (accountLimit !== null) {
			const [{ total = 0 } = {}] = await db
				.select({ total: sql<number>`coalesce(sum(${blobTable.size}), 0)` })
				.from(accountBlobTable)
				.innerJoin(blobTable, eq(blobTable.sha256, accountBlobTable.sha256))
				.where(eq(accountBlobTable.accountId, effectiveAccountId));

			if (total + body.byteLength > accountLimit) {
				return c.json({ type: "overQuota", description: "Account upload quota exceeded" }, 413);
			}
		}
	}

	const key = blobId;
	await c.env.R2_EMAILS.put(key, body, {
		httpMetadata: {
			contentType: contentTypeHeader,
		},
	});

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
			.values({
				accountId: effectiveAccountId,
				sha256: blobId,
				type: storedContentType,
				name: storedName,
				createdAt: now,
			})
			.onConflictDoUpdate({
				target: [accountBlobTable.accountId, accountBlobTable.sha256],
				set: {
					type: sql`coalesce(${accountBlobTable.type}, excluded.type)`,
					name: sql`coalesce(${accountBlobTable.name}, excluded.name)`,
				},
			});
	});

	return c.json(
		{
			accountId: effectiveAccountId,
			blobId,
			type: storedContentType,
			name: storedName,
			size: body.byteLength,
		},
		201
	);
}

function parseAccountUploadLimit(env: CloudflareBindings): number | null {
	const raw = env.JMAP_UPLOAD_ACCOUNT_LIMIT_BYTES;
	if (!raw) return null;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return null;
	}
	return parsed;
}

function getUndoWindowSeconds(env: CloudflareBindings): number | null {
	const raw = env.MAIL_UNDO_WINDOW_SECONDS;
	if (!raw) return null;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return null;
	}
	return Math.floor(parsed);
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
	let overrideType: string | null = null;
	if (typeParam) {
		const decodedType = decodeURIComponent(typeParam);
		const safeType = sanitizeMimeType(decodedType);
		if (!safeType) {
			return c.json({ type: "invalidArguments", description: "Invalid content type" }, 400);
		}
		overrideType = safeType;
	}

	const safeName = sanitizeFileName(requestedName);
	const db = getDB(c.env);
	const [row] = await db
		.select({
			size: blobTable.size,
			r2Key: blobTable.r2Key,
			type: accountBlobTable.type,
			name: accountBlobTable.name,
		})
		.from(accountBlobTable)
		.innerJoin(blobTable, eq(blobTable.sha256, accountBlobTable.sha256))
		.where(
			and(eq(accountBlobTable.accountId, effectiveAccountId), eq(accountBlobTable.sha256, blobId))
		)
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
	if (
		ifNoneMatch &&
		ifNoneMatch
			.split(",")
			.map((v) => v.trim())
			.includes(etag)
	) {
		return new Response(null, {
			status: 304,
			headers: {
				ETag: etag,
				"Cache-Control": "private, immutable, max-age=31536000",
			},
		});
	}

	const resolvedName = typeof row.name === "string" && row.name.length > 0 ? row.name : safeName;
	const effectiveName = sanitizeFileName(resolvedName);
	const resolvedContentType =
		overrideType ??
		(row.type ? sanitizeMimeType(row.type) : null) ??
		(object.httpMetadata?.contentType ? sanitizeMimeType(object.httpMetadata.contentType) : null) ??
		"application/octet-stream";

	const headers: Record<string, string> = {
		"Content-Type": resolvedContentType,
		ETag: etag,
		"Cache-Control": "private, immutable, max-age=31536000",
		"X-Content-Type-Options": "nosniff",
		"Content-Disposition": `attachment; filename="${encodeURIComponent(
			effectiveName
		)}"; filename*=UTF-8''${encodeURIComponent(effectiveName)}`,
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

	const url = new URL(c.req.url, c.env.BASE_API_URL);
	const params = url.searchParams;

	let requestedTypes: JmapStateType[] | null = null;
	const typeValues = params.getAll("types").flatMap((entry) =>
		entry
			.split(",")
			.map((value) => value.trim())
			.filter(Boolean)
	);
	if (typeValues.length > 0) {
		const parsed: JmapStateType[] = [];
		for (const value of typeValues) {
			if (!ALL_EVENT_SOURCE_TYPES.includes(value as JmapStateType)) {
				return c.json(
					{
						type: "invalidArguments",
						description: `Unsupported type ${value}`,
					},
					400
				);
			}
			if (!parsed.includes(value as JmapStateType)) {
				parsed.push(value as JmapStateType);
			}
		}
		requestedTypes = parsed;
	}

	const closeAfterParam = params.get("closeAfter");
	let closeAfter: "state" | "idle" | null = null;
	if (closeAfterParam) {
		if (closeAfterParam === "state" || closeAfterParam === "idle") {
			closeAfter = closeAfterParam;
		} else {
			return c.json(
				{
					type: "invalidArguments",
					description: "closeAfter must be 'state' or 'idle'",
				},
				400
			);
		}
	}

	let closeAfterIdleMs = 30_000;
	const closeAfterIdleParam = params.get("closeAfterIdle");
	if (closeAfterIdleParam !== null) {
		const parsed = Number(closeAfterIdleParam);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			return c.json(
				{
					type: "invalidArguments",
					description: "closeAfterIdle must be a positive number",
				},
				400
			);
		}
		closeAfterIdleMs = parsed * 1000;
	}

	let pingIntervalMs = SSE_DEFAULT_POLL_MS;
	const pingParam = params.get("ping");
	if (pingParam !== null) {
		const parsed = Number(pingParam);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			return c.json(
				{
					type: "invalidArguments",
					description: "ping must be a positive number",
				},
				400
			);
		}
		pingIntervalMs = Math.max(500, parsed * 1000);
	}

	const monitoredTypes = requestedTypes ?? [...ALL_EVENT_SOURCE_TYPES];
	if (monitoredTypes.length === 0) {
		return c.json(
			{
				type: "invalidArguments",
				description: "At least one type must be requested",
			},
			400
		);
	}
	const monitoredTypeSet = new Set(monitoredTypes);

	const db = getDB(c.env);
	const snapshot = await db
		.select({ type: jmapStateTable.type, modSeq: jmapStateTable.modSeq })
		.from(jmapStateTable)
		.where(eq(jmapStateTable.accountId, effectiveAccountId));

	const snapshotMap = new Map(snapshot.map((row) => [row.type, row.modSeq ?? 0]));
	const changeMap: Record<string, string> = {};
	for (const type of monitoredTypes) {
		const modSeq = snapshotMap.get(type) ?? 0;
		changeMap[type] = String(modSeq);
	}

	let lastModSeq = snapshot.reduce((max, row) => {
		const value = Number(row.modSeq ?? 0);
		return value > max ? value : max;
	}, 0);

	const encoder = new TextEncoder();
	const signal = c.req.raw.signal;
	let abortListener: (() => void) | null = null;

	let idleTimer: ReturnType<typeof setTimeout> | null = null;
	const stream = new ReadableStream({
		start(controller) {
			let closed = false;

			const scheduleIdleClose = () => {
				if (closeAfter !== "idle") return;
				if (idleTimer) clearTimeout(idleTimer);
				idleTimer = setTimeout(() => stop(), closeAfterIdleMs);
			};

			const sendEvent = () => {
				const payload = JSON.stringify({
					accountId: effectiveAccountId,
					changed: { ...changeMap },
				});
				controller.enqueue(encoder.encode(`event: state\ndata: ${payload}\n\n`));
				scheduleIdleClose();
			};

			const sendComment = () => {
				controller.enqueue(encoder.encode(":\n\n"));
			};

			const stop = () => {
				if (closed) return;
				closed = true;
				if (idleTimer) {
					clearTimeout(idleTimer);
					idleTimer = null;
				}
				controller.close();
			};

			abortListener = () => stop();
			signal.addEventListener("abort", abortListener);

			sendEvent();
			if (closeAfter === "state") {
				stop();
				return;
			}

			const poll = async () => {
				while (!closed) {
					let rows: { type: string; modSeq: number }[] = [];
					try {
						rows = await db
							.select({
								type: changeLogTable.type,
								modSeq: changeLogTable.modSeq,
							})
							.from(changeLogTable)
							.where(
								and(
									eq(changeLogTable.accountId, effectiveAccountId),
									sql`${changeLogTable.modSeq} > ${lastModSeq}`
								)
							)
							.orderBy(changeLogTable.modSeq)
							.limit(256);
					} catch (err) {
						console.error("JMAP event source polling error", err);
					}

					if (rows.length > 0) {
						let hadRelevantChange = false;
						for (const row of rows) {
							lastModSeq = row.modSeq;
							const type = row.type as JmapStateType;
							if (!monitoredTypeSet.has(type)) {
								continue;
							}
							changeMap[type] = String(row.modSeq);
							hadRelevantChange = true;
						}
						if (hadRelevantChange) {
							sendEvent();
						}
					} else {
						sendComment();
					}

					const delay = rows.length > 0 ? Math.min(1000, pingIntervalMs) : pingIntervalMs;
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			};

			poll()
				.catch((err) => {
					console.error("JMAP event source loop error", err);
				})
				.finally(stop);
		},
		cancel() {
			if (abortListener) {
				signal.removeEventListener("abort", abortListener);
			}
			if (idleTimer) {
				clearTimeout(idleTimer);
				idleTimer = null;
			}
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

jmapApp.get("/.well-known/jmap", requireJWT, attachUserFromJwt, handleSession);
jmapApp.post("/jmap", requireJWT, attachUserFromJwt, handleJmap);
jmapApp.post("/jmap/upload/:accountId", requireJWT, attachUserFromJwt, handleBlobUploadHttp);
jmapApp.get(
	"/jmap/download/:accountId/:blobId/:name",
	requireJWT,
	attachUserFromJwt,
	handleBlobDownloadHttp
);
jmapApp.get("/jmap/event-source/:accountId", requireJWT, attachUserFromJwt, handleEventSource);
