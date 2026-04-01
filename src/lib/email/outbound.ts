import "@tanstack/react-start/server-only";

import { env } from "cloudflare:workers";

const MESSAGE_ID_DOMAIN_FALLBACK = "localhost";
const SUBJECT_MAX_LENGTH = 80;
type SendPlaintextEmailMessageArgs = {
	body: string;
	from: string;
	to: string;
};

const config = {
	apiSecret: env.OUTBOUND_API_SECRET,
	apiUrl: new URL("api/v1/send/message", env.OUTBOUND_API_URL),
};

function getMessageIdDomain(from: string): string {
	const [, rawDomain = ""] = from.split("@");
	const normalizedDomain = rawDomain.trim();

	return normalizedDomain || MESSAGE_ID_DOMAIN_FALLBACK;
}

export function createPlaintextEmailSubject(body: string): string {
	const firstNonEmptyLine =
		body
			.split(/\r?\n/)
			.find((line) => line.trim().length > 0)
			?.trim() || body.trim();
	const normalizedSubject = firstNonEmptyLine.replace(/\s+/g, " ");

	if (normalizedSubject.length <= SUBJECT_MAX_LENGTH) {
		return normalizedSubject;
	}

	return `${normalizedSubject.slice(0, SUBJECT_MAX_LENGTH - 3).trimEnd()}...`;
}

export function createOutboundMessageId(from: string): string {
	return `<${crypto.randomUUID()}@${getMessageIdDomain(from)}>`;
}

export async function sendPlaintextEmailMessage({
	body,
	from,
	to,
}: SendPlaintextEmailMessageArgs): Promise<{ messageId: string }> {
	const { apiSecret, apiUrl } = config;
	const messageId = createOutboundMessageId(from);

	let response: Response;

	try {
		response = await fetch(apiUrl, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-server-api-key": apiSecret,
			},
			body: JSON.stringify({
				from,
				headers: {
					"Message-ID": messageId,
					"X-App": "gebna.net",
				},
				reply_to: from,
				subject: createPlaintextEmailSubject(body),
				plain_body: body,
				to: [to],
			}),
		});
	} catch (error) {
		throw new Error(`Failed to reach the outbound service`);
	}

	let payload: { status?: string } | null = null;

	try {
		payload = (await response.json()) as { status?: string };
	} catch {}

	if (!response.ok || payload?.status !== "success") {
		throw new Error();
	}

	return { messageId };
}
