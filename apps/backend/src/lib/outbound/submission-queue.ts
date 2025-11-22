import { and, eq, inArray, lte } from "drizzle-orm";

import { getDB } from "../../db";
import {
	accountMessageTable,
	emailSubmissionTable,
	messageTable,
} from "../../db/schema";
import { createOutboundTransport } from ".";
import { DeliveryStatusRecord } from "../types";

export const QUEUE_STATUS_PENDING = "pending";
export const QUEUE_STATUS_SENDING = "sending";
export const QUEUE_STATUS_SENT = "sent";
export const QUEUE_STATUS_FAILED = "failed";
export const QUEUE_STATUS_CANCELED = "canceled";

const RETRY_DELAYS_SECONDS = [60, 300, 900, 3600, 21600];
const MAX_RETRY_ATTEMPTS = RETRY_DELAYS_SECONDS.length;

type ClaimedSubmission = {
	id: string;
	accountId: string;
	emailId: string;
	threadId: string;
	envelopeJson: string;
	retryCount: number;
	deliveryStatus: DeliveryStatusRecord;
	rawBlobSha256: string;
	size: number;
};

function computeNextAttemptDate(retryCount: number, now: Date): Date {
	const idx = Math.min(retryCount, RETRY_DELAYS_SECONDS.length - 1);
	return new Date(now.getTime() + RETRY_DELAYS_SECONDS[idx] * 1000);
}

function parseEnvelope(json: string): { mailFrom: string; rcptTo: string[] } | null {
	try {
		const parsed = JSON.parse(json) as { mailFrom: string; rcptTo: string[] } | null;
		if (!parsed || typeof parsed.mailFrom !== "string" || !Array.isArray(parsed.rcptTo)) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

async function claimSubmission(
	db: ReturnType<typeof getDB>,
	submissionId: string
): Promise<ClaimedSubmission | null> {
	const now = new Date();
	const nowEpochSeconds = Math.floor(now.getTime() / 1000);

	return db.transaction(async (tx) => {
		const rows = await tx
			.select({
				id: emailSubmissionTable.id,
				accountId: emailSubmissionTable.accountId,
				emailId: emailSubmissionTable.emailId,
				envelopeJson: emailSubmissionTable.envelopeJson,
				status: emailSubmissionTable.status,
				nextAttemptAt: emailSubmissionTable.nextAttemptAt,
				retryCount: emailSubmissionTable.retryCount,
				deliveryStatus: emailSubmissionTable.deliveryStatusJson,
				undoStatus: emailSubmissionTable.undoStatus,
				accountMessageId: accountMessageTable.id,
				accountMessageDeleted: accountMessageTable.isDeleted,
				threadId: accountMessageTable.threadId,
				rawBlobSha256: messageTable.rawBlobSha256,
				size: messageTable.size,
			})
			.from(emailSubmissionTable)
			.leftJoin(accountMessageTable, eq(emailSubmissionTable.emailId, accountMessageTable.id))
			.leftJoin(messageTable, eq(accountMessageTable.messageId, messageTable.id))
			.where(eq(emailSubmissionTable.id, submissionId))
			.limit(1);

		if (!rows.length) return null;
		const row = rows[0]!;
		if (row.status !== QUEUE_STATUS_PENDING) return null;
		if (row.nextAttemptAt && row.nextAttemptAt > now) return null;
		if (row.undoStatus === "canceled") return null;

		if (!row.accountMessageId || row.accountMessageDeleted || !row.threadId) {
			const deliveryStatus: DeliveryStatusRecord = {
				status: "failed",
				reason: "Email deleted before sending",
				lastAttempt: nowEpochSeconds,
				retryCount: row.retryCount,
				permanent: true,
			};
			await tx
				.update(emailSubmissionTable)
				.set({
					status: QUEUE_STATUS_FAILED,
					nextAttemptAt: null,
					undoStatus: "final",
					deliveryStatusJson: deliveryStatus,
					updatedAt: now,
				})
				.where(eq(emailSubmissionTable.id, submissionId));
			return null;
		}

		if (!row.rawBlobSha256 || row.size === null || row.size === undefined) {
			const deliveryStatus: DeliveryStatusRecord = {
				status: "failed",
				reason: "Email blob missing before sending",
				lastAttempt: nowEpochSeconds,
				retryCount: row.retryCount,
				permanent: true,
			};
			await tx
				.update(emailSubmissionTable)
				.set({
					status: QUEUE_STATUS_FAILED,
					nextAttemptAt: null,
					undoStatus: "final",
					deliveryStatusJson: deliveryStatus,
					updatedAt: now,
				})
				.where(eq(emailSubmissionTable.id, submissionId));
			return null;
		}

		const updated = await tx
			.update(emailSubmissionTable)
			.set({ status: QUEUE_STATUS_SENDING, undoStatus: "final", updatedAt: now })
			.where(and(eq(emailSubmissionTable.id, submissionId), eq(emailSubmissionTable.status, QUEUE_STATUS_PENDING)))
			.returning({ id: emailSubmissionTable.id });

		if (!updated.length) return null;

		return {
			id: row.id,
			accountId: row.accountId,
			emailId: row.emailId,
			threadId: row.threadId,
			envelopeJson: row.envelopeJson,
			retryCount: row.retryCount,
			deliveryStatus: row.deliveryStatus,
			rawBlobSha256: row.rawBlobSha256,
			size: row.size,
		};
	});
}

async function handleSendResult(
	db: ReturnType<typeof getDB>,
	submissionId: string,
	result: DeliveryStatusRecord,
	queueStatus: string,
	nextAttemptAt: Date | null,
	retryCount: number,
	now: Date
): Promise<void> {
	await db
		.update(emailSubmissionTable)
		.set({
			status: queueStatus,
			nextAttemptAt,
			retryCount,
			deliveryStatusJson: result,
			updatedAt: now,
		})
		.where(eq(emailSubmissionTable.id, submissionId));
}

async function sendClaimedSubmission(
	env: CloudflareBindings,
	db: ReturnType<typeof getDB>,
	claimed: ClaimedSubmission
): Promise<void> {
	const envConfig = env;
	const transport = createOutboundTransport(envConfig);
	const now = new Date();
	const nowEpochSeconds = Math.floor(now.getTime() / 1000);
	const envelope = parseEnvelope(claimed.envelopeJson);

	if (!envelope || envelope.rcptTo.length === 0) {
		const deliveryStatus: DeliveryStatusRecord = {
			status: "failed",
			reason: "Invalid envelope",
			lastAttempt: nowEpochSeconds,
			retryCount: claimed.retryCount,
			permanent: true,
		};
		await handleSendResult(db, claimed.id, deliveryStatus, QUEUE_STATUS_FAILED, null, claimed.retryCount, now);
		return;
	}

	let deliveryOutcome: Awaited<ReturnType<ReturnType<typeof createOutboundTransport>["send"]>>;
	try {
		deliveryOutcome = await transport.send({
			accountId: claimed.accountId,
			submissionId: claimed.id,
			emailId: claimed.emailId,
			envelope: {
				mailFrom: envelope.mailFrom,
				rcptTo: envelope.rcptTo,
			},
			mime: {
				kind: "blob",
				sha256: claimed.rawBlobSha256,
				size: claimed.size,
			},
		});
	} catch (err) {
		const nextRetryCount = claimed.retryCount + 1;
		if (nextRetryCount > MAX_RETRY_ATTEMPTS) {
			const deliveryStatus: DeliveryStatusRecord = {
				status: "failed",
				reason: "Transport error",
				lastAttempt: nowEpochSeconds,
				retryCount: nextRetryCount,
				permanent: false,
			};
			await handleSendResult(
				db,
				claimed.id,
				deliveryStatus,
				QUEUE_STATUS_FAILED,
				null,
				nextRetryCount,
				now
			);
			return;
		}

		const deliveryStatus: DeliveryStatusRecord = {
			status: "pending",
			reason: err instanceof Error ? err.message : "Unknown transport error",
			lastAttempt: nowEpochSeconds,
			retryCount: nextRetryCount,
			permanent: false,
		};
		const nextAttempt = computeNextAttemptDate(nextRetryCount, now);
		await handleSendResult(
			db,
			claimed.id,
			deliveryStatus,
			QUEUE_STATUS_PENDING,
			nextAttempt,
			nextRetryCount,
			now
		);
		return;
	}

	const nextRetryCount = claimed.retryCount + 1;
	let statusLabel: DeliveryStatusRecord["status"];
	if (deliveryOutcome.status === "accepted") {
		statusLabel = "accepted";
	} else if (deliveryOutcome.status === "rejected") {
		statusLabel = deliveryOutcome.permanent ? "rejected" : "pending";
	} else {
		statusLabel = deliveryOutcome.status;
	}

	const mappedStatus: DeliveryStatusRecord = {
		status: statusLabel,
		providerMessageId: deliveryOutcome.providerMessageId,
		providerRequestId: deliveryOutcome.providerRequestId,
		reason: deliveryOutcome.reason,
		lastAttempt: nowEpochSeconds,
		retryCount: nextRetryCount,
		permanent: deliveryOutcome.permanent,
	};

	if (deliveryOutcome.status === "accepted") {
		await handleSendResult(db, claimed.id, mappedStatus, QUEUE_STATUS_SENT, null, nextRetryCount, now);
		return;
	}

	if (deliveryOutcome.status === "rejected" && deliveryOutcome.permanent) {
		await handleSendResult(db, claimed.id, mappedStatus, QUEUE_STATUS_FAILED, null, nextRetryCount, now);
		return;
	}

	const shouldAbort = nextRetryCount > MAX_RETRY_ATTEMPTS;
	if (shouldAbort) {
		const finalStatus: DeliveryStatusRecord = {
			...mappedStatus,
			status: "failed",
			permanent: mappedStatus.permanent ?? false,
		};
		await handleSendResult(db, claimed.id, finalStatus, QUEUE_STATUS_FAILED, null, nextRetryCount, now);
		return;
	}

	const nextAttempt = computeNextAttemptDate(nextRetryCount, now);
	const pendingStatus: DeliveryStatusRecord = {
		...mappedStatus,
		status: "pending",
	};
	await handleSendResult(
		db,
		claimed.id,
		pendingStatus,
		QUEUE_STATUS_PENDING,
		nextAttempt,
		nextRetryCount,
		now
	);
}

export async function processEmailSubmissionQueue(
	env: CloudflareBindings,
	options?: { limit?: number }
): Promise<void> {
	const db = getDB(env);
	const limit = options?.limit ?? 10;
	const now = new Date();

	const candidates = await db
		.select({ id: emailSubmissionTable.id })
		.from(emailSubmissionTable)
		.where(
			and(
				inArray(emailSubmissionTable.status, [QUEUE_STATUS_PENDING]),
				lte(emailSubmissionTable.nextAttemptAt, now)
			)
		)
		.orderBy(emailSubmissionTable.createdAt)
		.limit(limit);

	for (const candidate of candidates) {
		await processSingleSubmission(env, candidate.id);
	}
}

export async function processSingleSubmission(env: CloudflareBindings, submissionId: string): Promise<void> {
	const db = getDB(env);
	const claimed = await claimSubmission(db, submissionId);
	if (!claimed) return;
	await sendClaimedSubmission(env, db, claimed);
}
