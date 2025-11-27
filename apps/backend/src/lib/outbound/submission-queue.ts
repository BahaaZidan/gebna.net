import { and, eq, inArray, lte } from "drizzle-orm";

import { getDB } from "../../db";
import {
	accountMessageTable,
	emailSubmissionTable,
	messageTable,
} from "../../db/schema";
import { createOutboundTransport } from ".";
import {
	applyDeliveryStatusToRecipients,
	formatSmtpReply,
	normalizeDeliveryStatusMap,
} from "../email-submission/delivery-status";
import { DeliveryStatusRecord } from "../types";
import { recordUpdate } from "../jmap/change-log";

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
	deliveryStatus: Record<string, DeliveryStatusRecord>;
	rawBlobSha256: string;
	size: number;
};

function buildDeliveryStatus(params: {
	code: number;
	enhanced: string;
	text: string;
	delivered: DeliveryStatusRecord["delivered"];
	providerMessageId?: string;
	providerRequestId?: string;
}): DeliveryStatusRecord {
	return {
		smtpReply: formatSmtpReply(params.code, params.enhanced, params.text),
		delivered: params.delivered,
		displayed: "unknown",
		providerMessageId: params.providerMessageId,
		providerRequestId: params.providerRequestId,
	};
}

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
				threadId: emailSubmissionTable.threadId,
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
		const envelopeForStatus = parseEnvelope(row.envelopeJson);
		const statusRecipients = envelopeForStatus?.rcptTo ?? null;
		const currentStatusMap = normalizeDeliveryStatusMap(row.deliveryStatus, statusRecipients);
		if (row.status !== QUEUE_STATUS_PENDING) return null;
		if (row.nextAttemptAt && row.nextAttemptAt > now) return null;
		if (row.undoStatus === "canceled") return null;

		if (!row.accountMessageId || row.accountMessageDeleted || !row.threadId) {
			const deliveryStatus: DeliveryStatusRecord = buildDeliveryStatus({
				code: 550,
				enhanced: "5.2.0",
				text: "Email deleted before sending",
				delivered: "no",
			});
			const statusMap = applyDeliveryStatusToRecipients(currentStatusMap, null, deliveryStatus);
			const failed = await tx
				.update(emailSubmissionTable)
				.set({
					status: QUEUE_STATUS_FAILED,
					nextAttemptAt: null,
					undoStatus: "final",
					deliveryStatusJson: statusMap,
					updatedAt: now,
				})
				.where(eq(emailSubmissionTable.id, submissionId))
				.returning({
					accountId: emailSubmissionTable.accountId,
					id: emailSubmissionTable.id,
				});
			if (failed.length) {
				await recordUpdate(tx, {
					accountId: failed[0]!.accountId,
					type: "EmailSubmission",
					objectId: failed[0]!.id,
					now,
					updatedProperties: ["status", "nextAttemptAt", "undoStatus", "deliveryStatus"],
				});
			}
			return null;
		}

		if (!row.rawBlobSha256 || row.size === null || row.size === undefined) {
			const deliveryStatus: DeliveryStatusRecord = buildDeliveryStatus({
				code: 550,
				enhanced: "5.3.0",
				text: "Email blob missing before sending",
				delivered: "no",
			});
			const statusMap = applyDeliveryStatusToRecipients(currentStatusMap, null, deliveryStatus);
			const failed = await tx
				.update(emailSubmissionTable)
				.set({
					status: QUEUE_STATUS_FAILED,
					nextAttemptAt: null,
					undoStatus: "final",
					deliveryStatusJson: statusMap,
					updatedAt: now,
				})
				.where(eq(emailSubmissionTable.id, submissionId))
				.returning({
					accountId: emailSubmissionTable.accountId,
					id: emailSubmissionTable.id,
				});
			if (failed.length) {
				await recordUpdate(tx, {
					accountId: failed[0]!.accountId,
					type: "EmailSubmission",
					objectId: failed[0]!.id,
					now,
					updatedProperties: ["status", "nextAttemptAt", "undoStatus", "deliveryStatus"],
				});
			}
			return null;
		}

		const updated = await tx
			.update(emailSubmissionTable)
			.set({ status: QUEUE_STATUS_SENDING, undoStatus: "final", updatedAt: now })
			.where(and(eq(emailSubmissionTable.id, submissionId), eq(emailSubmissionTable.status, QUEUE_STATUS_PENDING)))
			.returning({
				id: emailSubmissionTable.id,
				accountId: emailSubmissionTable.accountId,
			});

		if (!updated.length) return null;
		await recordUpdate(tx, {
			accountId: updated[0]!.accountId,
			type: "EmailSubmission",
			objectId: updated[0]!.id,
			now,
			updatedProperties: ["status", "undoStatus"],
		});

		return {
			id: row.id,
			accountId: row.accountId,
			emailId: row.emailId,
			threadId: row.threadId,
			envelopeJson: row.envelopeJson,
			retryCount: row.retryCount,
			deliveryStatus: currentStatusMap,
			rawBlobSha256: row.rawBlobSha256,
			size: row.size,
		};
	});
}

async function handleSendResult(
	db: ReturnType<typeof getDB>,
	submissionId: string,
	statusMap: Record<string, DeliveryStatusRecord>,
	queueStatus: string,
	nextAttemptAt: Date | null,
	retryCount: number,
	now: Date
): Promise<void> {
	const updated = await db
		.update(emailSubmissionTable)
		.set({
			status: queueStatus,
			nextAttemptAt,
			retryCount,
			deliveryStatusJson: statusMap,
			updatedAt: now,
		})
		.where(eq(emailSubmissionTable.id, submissionId))
		.returning({
			accountId: emailSubmissionTable.accountId,
			id: emailSubmissionTable.id,
		});

	if (!updated.length) {
		return;
	}

	await recordUpdate(db, {
		accountId: updated[0]!.accountId,
		type: "EmailSubmission",
		objectId: updated[0]!.id,
		now,
		updatedProperties: ["status", "nextAttemptAt", "retryCount", "deliveryStatus"],
	});
}

async function sendClaimedSubmission(
	env: CloudflareBindings,
	db: ReturnType<typeof getDB>,
	claimed: ClaimedSubmission
): Promise<void> {
	const envConfig = env;
	const transport = createOutboundTransport(envConfig);
	const now = new Date();
	const envelope = parseEnvelope(claimed.envelopeJson);

	if (!envelope || envelope.rcptTo.length === 0) {
		const deliveryStatus: DeliveryStatusRecord = buildDeliveryStatus({
			code: 550,
			enhanced: "5.5.4",
			text: "Invalid envelope",
			delivered: "no",
		});
		const statusMap = applyDeliveryStatusToRecipients(claimed.deliveryStatus, null, deliveryStatus);
		await handleSendResult(
			db,
			claimed.id,
			statusMap,
			QUEUE_STATUS_FAILED,
			null,
			claimed.retryCount,
			now
		);
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
			const deliveryStatus: DeliveryStatusRecord = buildDeliveryStatus({
				code: 550,
				enhanced: "5.4.4",
				text: "Transport error",
				delivered: "no",
			});
			const statusMap = applyDeliveryStatusToRecipients(claimed.deliveryStatus, envelope.rcptTo, deliveryStatus);
			await handleSendResult(
				db,
				claimed.id,
				statusMap,
				QUEUE_STATUS_FAILED,
				null,
				nextRetryCount,
				now
			);
			return;
		}

		const deliveryStatus: DeliveryStatusRecord = buildDeliveryStatus({
			code: 451,
			enhanced: "4.4.0",
			text: err instanceof Error ? err.message : "Unknown transport error",
			delivered: "queued",
		});
		const nextAttempt = computeNextAttemptDate(nextRetryCount, now);
		const statusMap = applyDeliveryStatusToRecipients(claimed.deliveryStatus, envelope.rcptTo, deliveryStatus);
		await handleSendResult(
			db,
			claimed.id,
			statusMap,
			QUEUE_STATUS_PENDING,
			nextAttempt,
			nextRetryCount,
			now
		);
		return;
	}

	const nextRetryCount = claimed.retryCount + 1;

	if (deliveryOutcome.status === "accepted") {
		const acceptedStatus = buildDeliveryStatus({
			code: 250,
			enhanced: "2.0.0",
			text: deliveryOutcome.reason ?? "Accepted by outbound transport",
			delivered: "queued",
			providerMessageId: deliveryOutcome.providerMessageId,
			providerRequestId: deliveryOutcome.providerRequestId,
		});
		const statusMap = applyDeliveryStatusToRecipients(claimed.deliveryStatus, envelope.rcptTo, acceptedStatus);
		await handleSendResult(db, claimed.id, statusMap, QUEUE_STATUS_SENT, null, nextRetryCount, now);
		return;
	}

	if (deliveryOutcome.status === "rejected" && deliveryOutcome.permanent) {
		const rejectedStatus = buildDeliveryStatus({
			code: 550,
			enhanced: "5.7.1",
			text: deliveryOutcome.reason ?? "Message rejected by outbound transport",
			delivered: "no",
			providerMessageId: deliveryOutcome.providerMessageId,
			providerRequestId: deliveryOutcome.providerRequestId,
		});
		const statusMap = applyDeliveryStatusToRecipients(claimed.deliveryStatus, envelope.rcptTo, rejectedStatus);
		await handleSendResult(db, claimed.id, statusMap, QUEUE_STATUS_FAILED, null, nextRetryCount, now);
		return;
	}

	const shouldAbort = nextRetryCount > MAX_RETRY_ATTEMPTS;
	if (shouldAbort) {
		const finalStatus = buildDeliveryStatus({
			code: 550,
			enhanced: "5.4.1",
			text: deliveryOutcome.reason ?? "Delivery failed after retries",
			delivered: "no",
			providerMessageId: deliveryOutcome.providerMessageId,
			providerRequestId: deliveryOutcome.providerRequestId,
		});
		const statusMap = applyDeliveryStatusToRecipients(claimed.deliveryStatus, envelope.rcptTo, finalStatus);
		await handleSendResult(db, claimed.id, statusMap, QUEUE_STATUS_FAILED, null, nextRetryCount, now);
		return;
	}

	const nextAttempt = computeNextAttemptDate(nextRetryCount, now);
	const pendingStatus = buildDeliveryStatus({
		code: 451,
		enhanced: "4.4.0",
		text: deliveryOutcome.reason ?? "Temporary delivery issue",
		delivered: "queued",
		providerMessageId: deliveryOutcome.providerMessageId,
		providerRequestId: deliveryOutcome.providerRequestId,
	});
	const statusMap = applyDeliveryStatusToRecipients(claimed.deliveryStatus, envelope.rcptTo, pendingStatus);
	await handleSendResult(
		db,
		claimed.id,
		statusMap,
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
