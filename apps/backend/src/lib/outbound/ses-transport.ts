import { signAwsRequest } from "../aws/sigv4";
import type { OutboundTransport } from "./transport";
import type { OutboundDeliveryResult, OutboundMessage } from "./types";

type SesOutboundTransportOptions = {
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	r2: R2Bucket;
};

const encoder = new TextEncoder();

type JsonObject = { [key: string]: unknown };

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractMessageId(payload: unknown): string | undefined {
	if (!isJsonObject(payload)) return undefined;

	const candidates = ["MessageId", "messageId", "message_id"] as const;
	for (const key of candidates) {
		const value = payload[key];
		if (typeof value === "string") return value;
	}
	return undefined;
}

function extractErrorReason(payload: unknown): string | undefined {
	if (!isJsonObject(payload)) return undefined;

	const candidates = ["message", "Message", "error"] as const;
	for (const key of candidates) {
		const value = payload[key];
		if (typeof value === "string") return value;
	}
	return undefined;
}

async function getRawBytesFromMessage(
	message: OutboundMessage,
	r2: R2Bucket
): Promise<Uint8Array | null> {
	if (message.mime.kind === "inline") {
		return encoder.encode(message.mime.raw);
	}

	const obj = await r2.get(message.mime.sha256);
	if (!obj) return null;

	const buf = await obj.arrayBuffer();
	return new Uint8Array(buf);
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

export class SesOutboundTransport implements OutboundTransport {
	private readonly region: string;
	private readonly accessKeyId: string;
	private readonly secretAccessKey: string;
	private readonly r2: R2Bucket;

	constructor(opts: SesOutboundTransportOptions) {
		this.region = opts.region;
		this.accessKeyId = opts.accessKeyId;
		this.secretAccessKey = opts.secretAccessKey;
		this.r2 = opts.r2;
	}

	async send(message: OutboundMessage): Promise<OutboundDeliveryResult> {
		const rawBytes = await getRawBytesFromMessage(message, this.r2);
		if (!rawBytes) {
			const sha = message.mime.kind === "blob" ? message.mime.sha256 : "inline-mime-missing";

			return {
				status: "failed",
				reason: `Raw MIME blob not found in R2 for sha256=${sha}`,
				permanent: false,
			};
		}

		const rawBase64 = bytesToBase64(rawBytes);

		const payload = {
			FromEmailAddress: message.envelope.mailFrom,
			Destination: {
				ToAddresses: message.envelope.rcptTo,
			},
			Content: {
				Raw: {
					Data: rawBase64,
				},
			},
			EmailTags: [
				{ Name: "accountId", Value: message.accountId },
				{ Name: "submissionId", Value: message.submissionId },
				{ Name: "emailId", Value: message.emailId },
			],
		};

		const body = JSON.stringify(payload);
		const endpoint = new URL(`https://email.${this.region}.amazonaws.com/v2/email/outbound-emails`);

		let headers: Record<string, string>;
		try {
			headers = await signAwsRequest({
				method: "POST",
				url: endpoint,
				service: "ses",
				region: this.region,
				accessKeyId: this.accessKeyId,
				secretAccessKey: this.secretAccessKey,
				body,
			});
		} catch (err) {
			console.error("SES signing error", err);
			return {
				status: "failed",
				reason: "Failed to sign SES request",
				permanent: false,
			};
		}

		let response: Response;
		try {
			response = await fetch(endpoint.toString(), {
				method: "POST",
				headers,
				body,
			});
		} catch (err) {
			console.error("SES network error", err);
			return {
				status: "failed",
				reason: "Network error talking to SES",
				permanent: false,
			};
		}

		const requestId = response.headers.get("x-amzn-requestid") ?? undefined;
		const text = await response.text();

		let json: unknown;
		try {
			json = text ? JSON.parse(text) : undefined;
		} catch {
			json = undefined;
		}

		if (response.ok) {
			const messageId = extractMessageId(json);
			return {
				status: "accepted",
				providerMessageId: messageId,
				providerRequestId: requestId,
			};
		}

		const isPermanent = response.status >= 400 && response.status < 500;
		const extractedReason = extractErrorReason(json);
		const fallback =
			response.statusText && response.statusText.length > 0
				? response.statusText
				: text.slice(0, 512);

		const reason = extractedReason ?? `SES error ${response.status}: ${fallback}`;

		return {
			status: "rejected",
			providerRequestId: requestId,
			reason,
			permanent: isPermanent,
		};
	}
}
