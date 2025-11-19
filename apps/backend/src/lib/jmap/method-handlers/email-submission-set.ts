import { and, eq, inArray } from "drizzle-orm";
import { Context } from "hono";

import { getDB, TransactionInstance } from "../../../db";
import {
	accountMessageTable,
	addressTable,
	emailKeywordTable,
	emailSubmissionTable,
	identityTable,
	mailboxMessageTable,
	messageAddressTable,
	messageTable,
} from "../../../db/schema";
import { createOutboundTransport } from "../../outbound";
import { DeliveryStatusRecord } from "../../types";
import { recordEmailUpdateChanges } from "../change-log";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountMailboxes, getAccountState, isRecord } from "../utils";

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

	// No-op if nothing to create for now; update/destroy can be added later.
	if (createEntries.length === 0) {
		return {
			accountId,
			oldState: await getAccountState(db, accountId, "Email"),
			created,
			notCreated: {},
			updated,
			destroyed,
		};
	}

	const transport = createOutboundTransport(env);
	const now = new Date();
	const nowEpochSeconds = Math.floor(now.getTime() / 1000);
	const mailboxInfo = await getAccountMailboxes(db, accountId);
	const sentMailboxId = mailboxInfo.byRole.get("sent")?.id ?? null;
	const draftsMailboxId = mailboxInfo.byRole.get("drafts")?.id ?? null;
	const oldStateValue = await getAccountState(db, accountId, "Email");
	let emailStateChanged = false;

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

		let submissionStatus: DeliveryStatusRecord["status"];
		if (deliveryResult.status === "accepted") {
			submissionStatus = "accepted";
		} else if (deliveryResult.status === "rejected") {
			submissionStatus = "rejected";
		} else {
			submissionStatus = "failed";
		}

		const deliveryStatus: DeliveryStatusRecord = {
			status: submissionStatus,
			providerMessageId: deliveryResult.providerMessageId,
			providerRequestId: deliveryResult.providerRequestId,
			reason: deliveryResult.reason,
			lastAttempt: nowEpochSeconds,
			retryCount: 0,
			permanent: deliveryResult.permanent,
		};

		await db.transaction(async (tx) => {
			await tx.insert(emailSubmissionTable).values({
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

			if (deliveryResult.status === "accepted") {
				await finalizeEmailAfterSubmission({
					tx,
					accountId,
					emailId: parsed.emailId,
					threadId: accountMessage.threadId,
					sentMailboxId,
					draftsMailboxId,
					now,
				});
				emailStateChanged = true;
			}
		});

		created[createId] = {
			id: submissionId,
			emailId: parsed.emailId,
			identityId: parsed.identityId,
		};
	}

	const newState = emailStateChanged
		? await getAccountState(db, accountId, "Email")
		: oldStateValue;

	return {
		accountId,
		oldState: oldStateValue,
		newState,
		created,
		notCreated,
		updated,
		destroyed,
	};
}

async function finalizeEmailAfterSubmission(opts: {
	tx: TransactionInstance;
	accountId: string;
	emailId: string;
	threadId: string;
	sentMailboxId: string | null;
	draftsMailboxId: string | null;
	now: Date;
}): Promise<void> {
	const { tx, accountId, emailId, threadId, sentMailboxId, draftsMailboxId, now } = opts;
	const touchedMailboxIds: string[] = [];

	const membershipRows = await tx
		.select({ mailboxId: mailboxMessageTable.mailboxId })
		.from(mailboxMessageTable)
		.where(eq(mailboxMessageTable.accountMessageId, emailId));

	const membershipSet = new Set(membershipRows.map((row) => row.mailboxId));

	if (draftsMailboxId && membershipSet.has(draftsMailboxId)) {
		await tx
			.delete(mailboxMessageTable)
			.where(
				and(
					eq(mailboxMessageTable.accountMessageId, emailId),
					eq(mailboxMessageTable.mailboxId, draftsMailboxId)
				)
			);
		touchedMailboxIds.push(draftsMailboxId);
	}

	if (sentMailboxId && !membershipSet.has(sentMailboxId)) {
		await tx
			.insert(mailboxMessageTable)
			.values({
				accountMessageId: emailId,
				mailboxId: sentMailboxId,
				addedAt: now,
			})
			.onConflictDoNothing();
		touchedMailboxIds.push(sentMailboxId);
	}

	await tx
		.update(accountMessageTable)
		.set({
			isDraft: false,
			updatedAt: now,
		})
		.where(eq(accountMessageTable.id, emailId));

	await tx
		.delete(emailKeywordTable)
		.where(
			and(
				eq(emailKeywordTable.accountMessageId, emailId),
				inArray(emailKeywordTable.keyword, ["$draft", "\\draft"])
			)
		);

	await recordEmailUpdateChanges({
		tx,
		accountId,
		accountMessageId: emailId,
		threadId,
		mailboxIds: touchedMailboxIds,
		now,
	});
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
