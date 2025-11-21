import { v } from "@gebna/validation";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";

import { getDB } from "./db";
import { jmapStateTable } from "./db/schema";
import {
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
import { JmapMethodResponse } from "./lib/jmap/types";
import { handleMailboxSet } from "./lib/jmap/method-handlers/mailbox-set";

const SUPPORTED_CAPABILITIES = new Set([JMAP_CORE, JMAP_MAIL, JMAP_SUBMISSION, JMAP_VACATION]);

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
) => Promise<JmapMethodResponse>;

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
				},
			},
		},
		primaryAccounts: {
			[JMAP_CORE]: accountId,
			[JMAP_MAIL]: accountId,
			[JMAP_SUBMISSION]: accountId,
			[JMAP_VACATION]: accountId,
		},
		username: userId,
		apiUrl: c.env.BASE_API_URL,
		downloadUrl: `${c.env.BASE_API_URL}${c.env.JMAP_DOWNLOAD_PATH}`,
		uploadUrl: `${c.env.BASE_API_URL}${c.env.JMAP_UPLOAD_PATH}`,
		eventSourceUrl: null,
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
			methodResponses.push(resp);
		} catch (err) {
			console.error("JMAP method error", name, err);
			methodResponses.push(["error", { type: "serverError" }, tag]);
		}
	}

	return c.json({ methodResponses });
}

export const jmapApp = new Hono<JMAPHonoAppEnv>();

jmapApp.use(requireJWT);
jmapApp.use(attachUserFromJwt);

jmapApp.get("/.well-known/jmap", handleSession);
jmapApp.post("/jmap", handleJmap);
