import { and, eq, inArray } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import {
	accountMessageTable,
	addressTable,
	emailSubmissionTable,
	identityTable,
	messageAddressTable,
	messageTable,
} from "../../../db/schema";
import { createOutboundTransport } from "../../outbound";
import { DeliveryStatusRecord } from "../../types";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState, isRecord } from "../utils";

export async function handleEmailSubmissionSet(
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

	const input: EmailSubmissionSetArgs = {
		accountId: effectiveAccountId,
		create: (args.create as Record<string, unknown> | undefined) ?? undefined,
		update: (args.update as Record<string, unknown> | undefined) ?? undefined,
		destroy: (args.destroy as string[] | undefined) ?? undefined,
	};

	try {
		const result = await applyEmailSubmissionSet(c.env, db, input);

		return [
			"EmailSubmission/set",
			{
				accountId: result.accountId,
				oldState: result.oldState ?? state,
				newState: result.newState ?? state,
				created: result.created,
				updated: result.updated,
				destroyed: result.destroyed,
			},
			tag,
		];
	} catch (err) {
		console.error("EmailSubmission/set error", err);
		return ["error", { type: "serverError" }, tag];
	}
}

async function applyEmailSubmissionSet(
	env: JMAPHonoAppEnv["Bindings"],
	db: ReturnType<typeof getDB>,
	args: EmailSubmissionSetArgs
): Promise<EmailSubmissionSetResult> {
	const accountId = args.accountId;
	const createMap = args.create ?? {};

	const created: Record<string, unknown> = {};
	const updated: Record<string, unknown> = {};
	const destroyed: string[] = [];

	const createEntries = Object.entries(createMap);

	// No-op if nothing to create for now; update/destroy can be added later.
	if (createEntries.length === 0) {
		return {
			accountId,
			created,
			updated,
			destroyed,
		};
	}

	const transport = createOutboundTransport(env);
	const now = new Date();
	const nowEpochSeconds = Math.floor(now.getTime() / 1000);

	for (const [createId, raw] of createEntries) {
		const parsed = parseEmailSubmissionCreate(raw);

		// 1) Validate identity belongs to this account
		const [identity] = await db
			.select({
				id: identityTable.id,
				email: identityTable.email,
			})
			.from(identityTable)
			.where(and(eq(identityTable.id, parsed.identityId), eq(identityTable.accountId, accountId)))
			.limit(1);

		if (!identity) {
			throw new Error("EmailSubmission/create.identityId does not belong to this account");
		}

		// 2) Resolve account message + canonical message
		const [accountMessage] = await db
			.select({
				id: accountMessageTable.id,
				messageId: accountMessageTable.messageId,
			})
			.from(accountMessageTable)
			.where(
				and(
					eq(accountMessageTable.id, parsed.emailId),
					eq(accountMessageTable.accountId, accountId)
				)
			)
			.limit(1);

		if (!accountMessage) {
			throw new Error("EmailSubmission/create.emailId not found for this account");
		}

		const [messageRow] = await db
			.select({
				id: messageTable.id,
				rawBlobSha256: messageTable.rawBlobSha256,
				size: messageTable.size,
			})
			.from(messageTable)
			.where(eq(messageTable.id, accountMessage.messageId))
			.limit(1);

		if (!messageRow) {
			throw new Error("Canonical message for EmailSubmission/create.emailId not found");
		}

		// 3) Build envelope (override -> JMAP envelope; fallback -> identity + message addresses)
		const envelope = await resolveEnvelopeForSubmission({
			db,
			messageId: messageRow.id,
			identityEmail: identity.email,
			override: parsed.envelope,
		});

		// 4) Call outbound transport
		const submissionId = crypto.randomUUID();

		const deliveryResult = await transport.send({
			accountId,
			submissionId,
			emailId: parsed.emailId,
			envelope: {
				mailFrom: envelope.mailFrom,
				rcptTo: envelope.rcptTo,
			},
			mime: {
				kind: "blob",
				sha256: messageRow.rawBlobSha256,
				size: messageRow.size,
			},
		});

		const deliveryStatus: DeliveryStatusRecord = {
			status:
				// eslint-disable-next-line no-nested-ternary
				deliveryResult.status === "accepted"
					? "accepted"
					: deliveryResult.status === "rejected"
						? "rejected"
						: "failed",
			providerMessageId: deliveryResult.providerMessageId,
			providerRequestId: deliveryResult.providerRequestId,
			reason: deliveryResult.reason,
			lastAttempt: nowEpochSeconds,
			retryCount: 0,
			permanent: deliveryResult.permanent,
		};

		// 5) Persist EmailSubmission row
		await db.insert(emailSubmissionTable).values({
			id: submissionId,
			accountId,
			emailId: parsed.emailId,
			identityId: parsed.identityId,
			envelopeJson: JSON.stringify(envelope),
			sendAt: null,
			deliveryStatusJson: deliveryStatus,
			undoStatus: null,
			createdAt: now,
			updatedAt: now,
		});

		// 6) JMAP response object for this creationId
		created[createId] = {
			id: submissionId,
			emailId: parsed.emailId,
			identityId: parsed.identityId,
		};
	}

	// We are not bumping jmapStateTable / changeLogTable yet; Email state changes will come
	// together with Email/set (moving from Drafts -> Sent, etc).
	return {
		accountId,
		created,
		updated,
		destroyed,
	};
}

async function resolveEnvelopeForSubmission(options: {
	db: ReturnType<typeof getDB>;
	messageId: string;
	identityEmail: string;
	override?: EmailSubmissionEnvelopeOverride;
}): Promise<ResolvedEnvelope> {
	const { db, messageId, identityEmail, override } = options;

	const mailFrom =
		override?.mailFrom?.email !== undefined && override.mailFrom.email.length > 0
			? override.mailFrom.email
			: identityEmail;

	if (override?.rcptTo !== undefined && override.rcptTo.length > 0) {
		const rcptTo = override.rcptTo.map((r) => r.email);
		return { mailFrom, rcptTo };
	}

	const rows = await db
		.select({ email: addressTable.email })
		.from(messageAddressTable)
		.innerJoin(addressTable, eq(messageAddressTable.addressId, addressTable.id))
		.where(
			and(
				eq(messageAddressTable.messageId, messageId),
				inArray(messageAddressTable.kind, ["to", "cc", "bcc"])
			)
		)
		.orderBy(messageAddressTable.kind, messageAddressTable.position);

	const seen = new Set<string>();
	const rcptTo: string[] = [];

	for (const row of rows) {
		const email = row.email;
		if (!seen.has(email)) {
			seen.add(email);
			rcptTo.push(email);
		}
	}

	if (rcptTo.length === 0) {
		throw new Error("EmailSubmission/create has no recipients; rcptTo is empty");
	}

	return { mailFrom, rcptTo };
}

function parseEmailSubmissionCreate(raw: unknown): EmailSubmissionCreate {
	if (!isRecord(raw)) {
		throw new Error("EmailSubmission/create must be an object");
	}

	const emailIdValue = raw.emailId;
	if (typeof emailIdValue !== "string" || emailIdValue.length === 0) {
		throw new Error("EmailSubmission/create.emailId must be a non-empty string");
	}

	const identityIdValue = raw.identityId;
	if (typeof identityIdValue !== "string" || identityIdValue.length === 0) {
		throw new Error("EmailSubmission/create.identityId must be a non-empty string");
	}

	const result: EmailSubmissionCreate = {
		emailId: emailIdValue,
		identityId: identityIdValue,
	};

	const envelopeValue = raw.envelope;
	if (envelopeValue !== undefined) {
		if (!isRecord(envelopeValue)) {
			throw new Error("EmailSubmission/create.envelope must be an object when present");
		}

		const envelope: EmailSubmissionEnvelopeOverride = {};

		const mailFromValue = envelopeValue.mailFrom;
		if (mailFromValue !== undefined) {
			if (!isRecord(mailFromValue) || typeof mailFromValue.email !== "string") {
				throw new Error(
					"EmailSubmission/create.envelope.mailFrom.email must be a string when present"
				);
			}
			envelope.mailFrom = { email: mailFromValue.email };
		}

		const rcptToValue = envelopeValue.rcptTo;
		if (rcptToValue !== undefined) {
			if (!Array.isArray(rcptToValue)) {
				throw new Error("EmailSubmission/create.envelope.rcptTo must be an array when present");
			}
			const rcptTo: { email: string }[] = [];
			for (const item of rcptToValue) {
				if (!isRecord(item) || typeof item.email !== "string") {
					throw new Error(
						"EmailSubmission/create.envelope.rcptTo items must have an email string property"
					);
				}
				rcptTo.push({ email: item.email });
			}
			envelope.rcptTo = rcptTo;
		}

		result.envelope = envelope;
	}

	const sendAtValue = raw.sendAt;
	if (typeof sendAtValue === "string") {
		result.sendAt = sendAtValue;
	}

	return result;
}

type EmailSubmissionCreate = {
	emailId: string;
	identityId: string;
	envelope?: EmailSubmissionEnvelopeOverride;
	sendAt?: string;
};

type ResolvedEnvelope = {
	mailFrom: string;
	rcptTo: string[];
};

type EmailSubmissionSetArgs = {
	accountId: string;
	create?: Record<string, unknown>;
	update?: Record<string, unknown>;
	destroy?: string[];
};

type EmailSubmissionSetResult = {
	accountId: string;
	oldState?: string;
	newState?: string;
	created: Record<string, unknown>;
	updated: Record<string, unknown>;
	destroyed: string[];
};

type EmailSubmissionEnvelopeOverride = {
	mailFrom?: { email: string };
	rcptTo?: { email: string }[];
};
