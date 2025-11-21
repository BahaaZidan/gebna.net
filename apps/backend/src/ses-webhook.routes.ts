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
		const snsType = typeof record.Sns?.Type === "string" ? record.Sns.Type : null;
		const signatureValid = await verifySnsSignature(record);
		if (!signatureValid) {
			console.warn("SNS signature verification failed");
			continue;
		}
		if (snsType === "SubscriptionConfirmation") {
			await handleSubscriptionConfirmation(record);
			continue;
		}
		if (snsType && snsType !== "Notification") {
			continue;
		}
		const message = parseNotification(record);
		const topicArn = typeof record.Sns?.TopicArn === "string" ? record.Sns.TopicArn : null;
		if (!topicArn || topicArn !== c.env.SES_TOPIC_ARN) {
			console.warn("Unexpected SES topic", { received: topicArn });
			continue;
		}
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

async function handleSubscriptionConfirmation(record: SnsRecord): Promise<void> {
	const message = parseNotification(record);
	const subscribeUrl = message && typeof message.SubscribeURL === "string" ? message.SubscribeURL : null;
	if (!subscribeUrl) return;
	try {
		const res = await fetch(subscribeUrl, { method: "GET" });
		if (!res.ok) {
			console.error("Failed to confirm SNS subscription", res.status);
		}
	} catch (err) {
		console.error("Error confirming SNS subscription", err);
	}
}

async function verifySnsSignature(record: SnsRecord): Promise<boolean> {
	const sns = record.Sns;
	if (!sns) return false;
	const type = typeof sns.Type === "string" ? sns.Type : null;
	const signature = typeof sns.Signature === "string" ? sns.Signature : null;
	const certUrl = typeof sns.SigningCertUrl === "string" ? sns.SigningCertUrl : null;
	const version = typeof sns.SignatureVersion === "string" ? sns.SignatureVersion : null;
	if (!type || !signature || !certUrl || version !== "1") {
		return false;
	}
	const canonical = buildCanonicalString(type, sns as unknown as Record<string, unknown>);
	if (!canonical) return false;
	const certKey = await getCertificate(certUrl);
	if (!certKey) return false;
	try {
		const verified = await crypto.subtle.verify(
			"RSASSA-PKCS1-v1_5",
			certKey,
			base64ToUint8Array(signature),
			new TextEncoder().encode(canonical)
		);
		return verified;
	} catch (err) {
		console.error("SNS signature verification error", err);
		return false;
	}
}

function buildCanonicalString(type: string, sns: Record<string, unknown>): string | null {
	const fields: Array<[string, string]> = [];
	const get = (key: string): string | undefined => {
		const value = sns[key];
		return typeof value === "string" ? value : undefined;
	};

	const pushField = (key: string, value?: string) => {
		if (value === undefined) return;
		fields.push([key, value]);
	};

	if (type === "Notification") {
		const message = get("Message");
		const messageId = get("MessageId");
		const timestamp = get("Timestamp");
		const topicArn = get("TopicArn");
		const subject = get("Subject");
		const typeValue = get("Type");
		if (!message || !messageId || !timestamp || !topicArn || !typeValue) {
			return null;
		}
		pushField("Message", message);
		pushField("MessageId", messageId);
		if (subject) pushField("Subject", subject);
		pushField("Timestamp", timestamp);
		pushField("TopicArn", topicArn);
		pushField("Type", typeValue);
	} else if (type === "SubscriptionConfirmation" || type === "UnsubscribeConfirmation") {
		const message = get("Message");
		const messageId = get("MessageId");
		const timestamp = get("Timestamp");
		const topicArn = get("TopicArn");
		const token = get("Token");
		const subscribeUrl = get("SubscribeURL");
		const typeValue = get("Type");
		if (!message || !messageId || !timestamp || !topicArn || !token || !subscribeUrl || !typeValue) {
			return null;
		}
		pushField("Message", message);
		pushField("MessageId", messageId);
		pushField("SubscribeURL", subscribeUrl);
		pushField("Timestamp", timestamp);
		pushField("Token", token);
		pushField("TopicArn", topicArn);
		pushField("Type", typeValue);
	} else {
		return null;
	}

	return fields.map(([key, value]) => `${key}\n${value}\n`).join("");
}

const CERT_CACHE = new Map<string, CryptoKey>();

async function getCertificate(urlStr: string): Promise<CryptoKey | null> {
	try {
		const url = new URL(urlStr);
		if (url.protocol !== "https:") return null;
		const hostname = url.hostname.toLowerCase();
		if (!hostname.endsWith(".amazonaws.com")) return null;
		if (!hostname.includes(".sns.")) return null;
		const cached = CERT_CACHE.get(urlStr);
		if (cached) return cached;
		const res = await fetch(urlStr);
		if (!res.ok) {
			console.error("Failed to download SNS certificate", res.status);
			return null;
		}
		const pem = await res.text();
		const key = await importCertificate(pem);
		if (key) {
			CERT_CACHE.set(urlStr, key);
		}
		return key;
	} catch (err) {
		console.error("Error fetching SNS certificate", err);
		return null;
	}
}

async function importCertificate(pem: string): Promise<CryptoKey | null> {
	const lines = pem.replace(/-----BEGIN CERTIFICATE-----/, "").replace(/-----END CERTIFICATE-----/, "");
	const normalized = lines.replace(/\\s+/g, "");
	const der = base64ToUint8Array(normalized);
	try {
		return await crypto.subtle.importKey(
			"spki",
			der,
			{
				name: "RSASSA-PKCS1-v1_5",
				hash: "SHA-1",
			},
			true,
			["verify"]
		);
	} catch (err) {
		console.error("Failed to import SNS certificate", err);
		return null;
	}
}

function base64ToUint8Array(value: string): Uint8Array {
	const sanitized = value.replace(/\\s+/g, "");
	let binary: string;
	if (typeof atob === "function") {
		binary = atob(sanitized);
	} else {
		const nodeBuffer = (globalThis as Record<string, unknown>).Buffer as
			| { from(data: string, encoding: string): { toString(enc: string): string } }
			| undefined;
		if (nodeBuffer && typeof nodeBuffer.from === "function") {
			binary = nodeBuffer.from(sanitized, "base64").toString("binary");
		} else {
			throw new Error("Base64 decoding not supported in this environment");
		}
	}
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}
