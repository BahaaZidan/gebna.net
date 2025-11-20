import type { SNSEvent } from "aws-lambda";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { getDB } from "./db";
import { emailSubmissionTable } from "./db/schema";
import { isRecord } from "./lib/jmap/utils";
import { DeliveryStatusRecord } from "./lib/types";

type SnsRecord = SNSEvent["Records"][number];

function isSnsRecord(value: unknown): value is SnsRecord {
	if (!isRecord(value)) return false;
	const sns = value.Sns;
	if (!isRecord(sns)) return false;
	return typeof sns.Message === "string";
}

function normalizeEvents(body: unknown): SnsRecord[] {
	if (!body) return [];
	if (Array.isArray(body)) {
		return body.filter(isSnsRecord);
	}
	if (isRecord(body) && Array.isArray(body.Records)) {
		return body.Records.filter(isSnsRecord);
	}
	return [];
}

function parseNotification(record: SnsRecord): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(record.Sns.Message);
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function extractSubmissionId(message: Record<string, unknown>): string | null {
	const mail = message.mail;
	if (!isRecord(mail)) return null;
	const tags = mail.tags;
	if (!isRecord(tags)) return null;
	const values = (tags.submissionId ?? tags.SubmissionId) as unknown;
	if (!Array.isArray(values) || values.length === 0) return null;
	const candidate = values[0];
	return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

function parseTimestamp(value: unknown): number | null {
	if (typeof value !== "string") return null;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function mapNotificationToStatus(
	message: Record<string, unknown>
): { queueStatus: string; status: DeliveryStatusRecord } | null {
	const eventTypeValue = message.eventType;
	if (typeof eventTypeValue !== "string") return null;
	const delivery = message.delivery;
	const mail = message.mail;
	const timestamp =
		(isRecord(delivery) && parseTimestamp(delivery.timestamp)) ||
		(isRecord(mail) && parseTimestamp(mail.timestamp)) ||
		Date.now();
	const lastAttempt = Math.floor(timestamp / 1000);
	const base: DeliveryStatusRecord = {
		status: "pending",
		lastAttempt,
		retryCount: 0,
	};

	switch (eventTypeValue.toUpperCase()) {
		case "DELIVERY":
			return {
				queueStatus: "sent",
				status: { ...base, status: "accepted", reason: "Delivered" },
			};
		case "BOUNCE": {
			const bounce = message.bounce;
			let diagnostic: string | null = null;
			if (isRecord(bounce) && Array.isArray(bounce.bouncedRecipients) && bounce.bouncedRecipients.length > 0) {
				const firstRecipient = bounce.bouncedRecipients[0];
				if (isRecord(firstRecipient) && typeof firstRecipient.diagnosticCode === "string") {
					diagnostic = firstRecipient.diagnosticCode;
				}
			}
			return {
				queueStatus: "failed",
				status: {
					...base,
					status: "rejected",
					reason: diagnostic ?? "Bounce",
					permanent: true,
				},
			};
		}
		case "REJECT": {
			const reject = message.reject;
			const reason = isRecord(reject) && typeof reject.reason === "string" ? reject.reason : "Rejected";
			return {
				queueStatus: "failed",
				status: {
					...base,
					status: "rejected",
					reason,
					permanent: true,
				},
			};
		}
		case "FAILURE": {
			const failure = message.failure;
			const reason =
				isRecord(failure) && typeof failure.errorMessage === "string" ? failure.errorMessage : "Failure";
			return {
				queueStatus: "failed",
				status: { ...base, status: "failed", reason },
			};
		}
		case "COMPLAINT": {
			const complaint = message.complaint;
			const reason =
				isRecord(complaint) && typeof complaint.complaintFeedbackType === "string"
					? complaint.complaintFeedbackType
					: "Complaint";
			return {
				queueStatus: "failed",
				status: {
					...base,
					status: "rejected",
					reason,
					permanent: true,
				},
			};
		}
		default:
			return null;
	}
}

export const sesWebhookApp = new Hono<{ Bindings: CloudflareBindings }>();

sesWebhookApp.post("/events", async (c) => {
	const token = c.env.SES_WEBHOOK_TOKEN;
	if (!token) {
		return c.json({ error: "Webhook token not configured" }, 500);
	}
	const provided = c.req.header("X-Webhook-Token");
	if (provided !== token) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	let payload: unknown;
	try {
		payload = await c.req.json();
	} catch {
		return c.json({ error: "Invalid JSON" }, 400);
	}

	const events = normalizeEvents(payload);
	if (!events.length) {
		return c.json({ processed: 0 });
	}

	const db = getDB(c.env);
	let processed = 0;

	for (const record of events) {
		const message = parseNotification(record);
		if (!message) continue;
		const submissionId = extractSubmissionId(message);
		if (!submissionId) continue;
		const mapped = mapNotificationToStatus(message);
		if (!mapped) continue;
		await db
			.update(emailSubmissionTable)
			.set({
				status: mapped.queueStatus,
				nextAttemptAt: null,
				deliveryStatusJson: mapped.status,
				updatedAt: new Date(),
			})
			.where(eq(emailSubmissionTable.id, submissionId));
		processed += 1;
	}

	return c.json({ processed });
});
