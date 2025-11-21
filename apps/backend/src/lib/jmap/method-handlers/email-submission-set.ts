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
import { processSingleSubmission } from "../../outbound/submission-queue";
import { DeliveryStatusRecord } from "../../types";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState, isRecord } from "../utils";
import { recordCreate } from "../change-log";

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

	const state = await getAccountState(db, effectiveAccountId, "EmailSubmission");

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
				notCreated: result.notCreated,
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
	const notCreated: Record<string, EmailSubmissionFailure> = {};
	const updated: Record<string, unknown> = {};
	const destroyed: string[] = [];

	const createEntries = Object.entries(createMap);
	const oldStateValue = await getAccountState(db, accountId, "EmailSubmission");

	if (createEntries.length === 0) {
		return {
			accountId,
			oldState: oldStateValue,
			newState: oldStateValue,
			created,
			notCreated: {},
			updated,
			destroyed,
		};
	}

	const now = new Date();
	const submissionsToProcess: string[] = [];

	for (const [createId, raw] of createEntries) {
		let parsed: EmailSubmissionCreate;
		try {
			parsed = parseEmailSubmissionCreate(raw);
		} catch (err) {
			if (err instanceof EmailSubmissionProblem) {
				notCreated[createId] = { type: err.jmapType, description: err.message };
				continue;
			}
			throw err;
		}
		const [identity] = await db
			.select({
				id: identityTable.id,
				email: identityTable.email,
			})
			.from(identityTable)
			.where(and(eq(identityTable.id, parsed.identityId), eq(identityTable.accountId, accountId)))
			.limit(1);

		if (!identity) {
			notCreated[createId] = {
				type: "invalidProperties",
				description: "identityId does not belong to this account",
			};
			continue;
		}

		const [accountMessage] = await db
			.select({
				id: accountMessageTable.id,
				messageId: accountMessageTable.messageId,
				threadId: accountMessageTable.threadId,
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
			notCreated[createId] = {
				type: "notFound",
				description: "emailId not found",
			};
			continue;
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
			notCreated[createId] = {
				type: "serverError",
				description: "Canonical message missing",
			};
			continue;
		}

		let envelope: ResolvedEnvelope;
		try {
			envelope = await resolveEnvelopeForSubmission({
				db,
				messageId: messageRow.id,
				identityEmail: identity.email,
				override: parsed.envelope,
			});
		} catch (err) {
			notCreated[createId] = {
				type: err instanceof EmailSubmissionProblem ? err.jmapType : "invalidProperties",
				description: err instanceof Error ? err.message : "Failed to resolve envelope",
			};
			continue;
		}

		const submissionId = crypto.randomUUID();

		const deliveryStatus: DeliveryStatusRecord = {
			status: "pending",
			lastAttempt: 0,
			retryCount: 0,
		};

		await db.insert(emailSubmissionTable).values({
			id: submissionId,
			accountId,
			emailId: parsed.emailId,
			identityId: parsed.identityId,
			envelopeJson: JSON.stringify(envelope),
			sendAt: null,
			status: "pending",
			nextAttemptAt: now,
			retryCount: 0,
			deliveryStatusJson: deliveryStatus,
			undoStatus: null,
			createdAt: now,
			updatedAt: now,
		});

		await recordCreate(db, {
			accountId,
			type: "EmailSubmission",
			objectId: submissionId,
			now,
		});

		submissionsToProcess.push(submissionId);

		created[createId] = {
			id: submissionId,
			emailId: parsed.emailId,
			identityId: parsed.identityId,
		};
	}

	for (const submissionId of submissionsToProcess) {
		try {
			await processSingleSubmission(env, submissionId);
		} catch (err) {
			console.error("EmailSubmission queue processing error", submissionId, err);
		}
	}

	const newStateValue =
		Object.keys(created).length > 0
			? await getAccountState(db, accountId, "EmailSubmission")
			: oldStateValue;

	return {
		accountId,
		oldState: oldStateValue,
		newState: newStateValue,
		created,
		notCreated,
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
		throw new EmailSubmissionProblem(
			"invalidProperties",
			"EmailSubmission/create has no recipients; rcptTo is empty"
		);
	}

	return { mailFrom, rcptTo };
}

function parseEmailSubmissionCreate(raw: unknown): EmailSubmissionCreate {
	if (!isRecord(raw)) {
		throw new EmailSubmissionProblem(
			"invalidProperties",
			"EmailSubmission/create must be an object"
		);
	}

	const emailIdValue = raw.emailId;
	if (typeof emailIdValue !== "string" || emailIdValue.length === 0) {
		throw new EmailSubmissionProblem(
			"invalidProperties",
			"EmailSubmission/create.emailId must be a non-empty string"
		);
	}

	const identityIdValue = raw.identityId;
	if (typeof identityIdValue !== "string" || identityIdValue.length === 0) {
		throw new EmailSubmissionProblem(
			"invalidProperties",
			"EmailSubmission/create.identityId must be a non-empty string"
		);
	}

	const result: EmailSubmissionCreate = {
		emailId: emailIdValue,
		identityId: identityIdValue,
	};

	const envelopeValue = raw.envelope;
	if (envelopeValue !== undefined) {
		if (!isRecord(envelopeValue)) {
			throw new EmailSubmissionProblem(
				"invalidProperties",
				"EmailSubmission/create.envelope must be an object when present"
			);
		}

		const envelope: EmailSubmissionEnvelopeOverride = {};

		const mailFromValue = envelopeValue.mailFrom;
		if (mailFromValue !== undefined) {
			if (!isRecord(mailFromValue) || typeof mailFromValue.email !== "string") {
				throw new EmailSubmissionProblem(
					"invalidProperties",
					"EmailSubmission/create.envelope.mailFrom.email must be a string when present"
				);
			}
			envelope.mailFrom = { email: mailFromValue.email };
		}

		const rcptToValue = envelopeValue.rcptTo;
		if (rcptToValue !== undefined) {
			if (!Array.isArray(rcptToValue)) {
				throw new EmailSubmissionProblem(
					"invalidProperties",
					"EmailSubmission/create.envelope.rcptTo must be an array when present"
				);
			}
			const rcptTo: { email: string }[] = [];
			for (const item of rcptToValue) {
				if (!isRecord(item) || typeof item.email !== "string") {
					throw new EmailSubmissionProblem(
						"invalidProperties",
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
	notCreated: Record<string, EmailSubmissionFailure>;
	updated: Record<string, unknown>;
	destroyed: string[];
};

type EmailSubmissionEnvelopeOverride = {
	mailFrom?: { email: string };
	rcptTo?: { email: string }[];
};

type EmailSubmissionFailure = {
	type: string;
	description?: string;
};

class EmailSubmissionProblem extends Error {
	readonly jmapType: string;

	constructor(type: string, message: string) {
		super(message);
		this.jmapType = type;
	}
}
