import "@tanstack/react-start/server-only";

export const POSTAL_OUTBOUND_WEBHOOK_EVENT_TYPES = [
	"MessageSent",
	"MessageDelayed",
	"MessageDeliveryFailed",
	"MessageHeld",
	"MessageBounced",
	"MessageLinkClicked",
	"MessageLoaded",
	"DomainDNSError",
] as const;

export type PostalOutboundWebhookEventType =
	(typeof POSTAL_OUTBOUND_WEBHOOK_EVENT_TYPES)[number];

type PostalMessageStatus = "Sent" | "Delayed" | "DeliveryFailed" | "Held";
type PostalMessageStatusEventType =
	| "MessageSent"
	| "MessageDelayed"
	| "MessageDeliveryFailed"
	| "MessageHeld";

type PostalMessage = {
	direction: "incoming" | "outgoing";
	from: string;
	id: number;
	message_id: string;
	spam_status: string;
	subject: string;
	tag: string | null;
	timestamp: number;
	to: string;
	token: string;
};

type PostalMessageStatusPayload = {
	details?: string | null;
	message: PostalMessage;
	output?: string | null;
	sent_with_ssl?: boolean | null;
	status: PostalMessageStatus;
	time?: number | null;
	timestamp: number;
};

type PostalMessageBouncePayload = {
	bounce: PostalMessage;
	original_message: PostalMessage;
};

type PostalMessageLinkClickedPayload = {
	ip_address: string;
	message: PostalMessage;
	token: string;
	url: string;
	user_agent: string;
};

type PostalMessageLoadedPayload = {
	ip_address: string;
	message: PostalMessage;
	user_agent: string;
};

type PostalDomainDNSErrorPayload = {
	dkim_error: string | null;
	dkim_status: string;
	dns_checked_at: number;
	domain: string;
	mx_error: string | null;
	mx_status: string;
	return_path_error: string | null;
	return_path_status: string;
	server: {
		name: string;
		organization: string;
		permalink: string;
		uuid: string;
	};
	spf_error: string | null;
	spf_status: string;
	uuid: string;
};

export type PostalOutboundWebhookEvent =
	| {
			payload: PostalMessageStatusPayload;
			type:
				| "MessageDelayed"
				| "MessageDeliveryFailed"
				| "MessageHeld"
				| "MessageSent";
	  }
	| { payload: PostalMessageBouncePayload; type: "MessageBounced" }
	| { payload: PostalMessageLinkClickedPayload; type: "MessageLinkClicked" }
	| { payload: PostalMessageLoadedPayload; type: "MessageLoaded" }
	| { payload: PostalDomainDNSErrorPayload; type: "DomainDNSError" };

const POSTAL_MESSAGE_STATUS_TO_EVENT_TYPE: Record<
	PostalMessageStatus,
	PostalMessageStatusEventType
> = {
	Sent: "MessageSent",
	Delayed: "MessageDelayed",
	DeliveryFailed: "MessageDeliveryFailed",
	Held: "MessageHeld",
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function isNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isPostalMessage(value: unknown): value is PostalMessage {
	if (!isObject(value)) return false;

	return (
		isNumber(value.id) &&
		isString(value.token) &&
		(value.direction === "incoming" || value.direction === "outgoing") &&
		isString(value.message_id) &&
		isString(value.to) &&
		isString(value.from) &&
		isString(value.subject) &&
		isNumber(value.timestamp) &&
		isString(value.spam_status) &&
		(value.tag === null || isString(value.tag))
	);
}

function isPostalMessageStatus(value: unknown): value is PostalMessageStatus {
	return (
		value === "Sent" ||
		value === "Delayed" ||
		value === "DeliveryFailed" ||
		value === "Held"
	);
}

function isPostalMessageStatusPayload(
	value: unknown,
): value is PostalMessageStatusPayload {
	if (!isObject(value)) return false;

	return (
		isPostalMessageStatus(value.status) &&
		isPostalMessage(value.message) &&
		isNumber(value.timestamp)
	);
}

function isPostalMessageBouncePayload(
	value: unknown,
): value is PostalMessageBouncePayload {
	if (!isObject(value)) return false;

	return (
		isPostalMessage(value.original_message) && isPostalMessage(value.bounce)
	);
}

function isPostalMessageLinkClickedPayload(
	value: unknown,
): value is PostalMessageLinkClickedPayload {
	if (!isObject(value)) return false;

	return (
		isString(value.url) &&
		isString(value.token) &&
		isString(value.ip_address) &&
		isString(value.user_agent) &&
		isPostalMessage(value.message)
	);
}

function isPostalMessageLoadedPayload(
	value: unknown,
): value is PostalMessageLoadedPayload {
	if (!isObject(value)) return false;

	return (
		isString(value.ip_address) &&
		isString(value.user_agent) &&
		isPostalMessage(value.message) &&
		!("url" in value)
	);
}

function isPostalDomainDNSErrorPayload(
	value: unknown,
): value is PostalDomainDNSErrorPayload {
	if (!isObject(value) || !isObject(value.server)) return false;

	return (
		isString(value.domain) &&
		isString(value.uuid) &&
		isNumber(value.dns_checked_at) &&
		isString(value.spf_status) &&
		(value.spf_error === null || isString(value.spf_error)) &&
		isString(value.dkim_status) &&
		(value.dkim_error === null || isString(value.dkim_error)) &&
		isString(value.mx_status) &&
		(value.mx_error === null || isString(value.mx_error)) &&
		isString(value.return_path_status) &&
		(value.return_path_error === null || isString(value.return_path_error)) &&
		isString(value.server.uuid) &&
		isString(value.server.name) &&
		isString(value.server.permalink) &&
		isString(value.server.organization)
	);
}

export function parsePostalOutboundWebhookEvent(
	payload: unknown,
): PostalOutboundWebhookEvent | null {
	console.log(JSON.stringify(payload, null, 4));
	if (isPostalMessageStatusPayload(payload)) {
		const type = POSTAL_MESSAGE_STATUS_TO_EVENT_TYPE[payload.status];

		return {
			type,
			payload,
		};
	}

	if (isPostalMessageBouncePayload(payload)) {
		return {
			type: "MessageBounced",
			payload,
		};
	}

	if (isPostalMessageLinkClickedPayload(payload)) {
		return {
			type: "MessageLinkClicked",
			payload,
		};
	}

	if (isPostalMessageLoadedPayload(payload)) {
		return {
			type: "MessageLoaded",
			payload,
		};
	}

	if (isPostalDomainDNSErrorPayload(payload)) {
		return {
			type: "DomainDNSError",
			payload,
		};
	}

	return null;
}

type PostalWebhookLogContext = {
	details?: string | null;
	domain?: string;
	ipAddress?: string;
	messageId?: string;
	postalMessageId?: number;
	recipient?: string;
	status?: string;
	url?: string;
};

function logPostalWebhook(
	type: PostalOutboundWebhookEventType,
	context: PostalWebhookLogContext,
) {
	console.info("postal outbound webhook received", {
		type,
		...context,
	});
}

async function handleMessageSent(payload: PostalMessageStatusPayload) {
	logPostalWebhook("MessageSent", {
		details: payload.details,
		messageId: payload.message.message_id,
		postalMessageId: payload.message.id,
		recipient: payload.message.to,
		status: payload.status,
	});

	// TODO: persist outbound delivery success against the matching local message.
}

async function handleMessageDelayed(payload: PostalMessageStatusPayload) {
	logPostalWebhook("MessageDelayed", {
		details: payload.details,
		messageId: payload.message.message_id,
		postalMessageId: payload.message.id,
		recipient: payload.message.to,
		status: payload.status,
	});

	// TODO: store retry state and expose that the message is delayed.
}

async function handleMessageDeliveryFailed(
	payload: PostalMessageStatusPayload,
) {
	logPostalWebhook("MessageDeliveryFailed", {
		details: payload.details,
		messageId: payload.message.message_id,
		postalMessageId: payload.message.id,
		recipient: payload.message.to,
		status: payload.status,
	});

	// TODO: mark the outbound message as failed and surface the failure reason.
}

async function handleMessageHeld(payload: PostalMessageStatusPayload) {
	logPostalWebhook("MessageHeld", {
		details: payload.details,
		messageId: payload.message.message_id,
		postalMessageId: payload.message.id,
		recipient: payload.message.to,
		status: payload.status,
	});

	// TODO: track held messages so they can be reviewed or released later.
}

async function handleMessageBounced(payload: PostalMessageBouncePayload) {
	logPostalWebhook("MessageBounced", {
		messageId: payload.original_message.message_id,
		postalMessageId: payload.original_message.id,
		recipient: payload.original_message.to,
	});

	// TODO: attach bounce details to the original outbound message/thread.
}

async function handleMessageLinkClicked(
	payload: PostalMessageLinkClickedPayload,
) {
	logPostalWebhook("MessageLinkClicked", {
		ipAddress: payload.ip_address,
		messageId: payload.message.message_id,
		postalMessageId: payload.message.id,
		recipient: payload.message.to,
		url: payload.url,
	});

	// TODO: record click analytics for outbound tracked links.
}

async function handleMessageLoaded(payload: PostalMessageLoadedPayload) {
	logPostalWebhook("MessageLoaded", {
		ipAddress: payload.ip_address,
		messageId: payload.message.message_id,
		postalMessageId: payload.message.id,
		recipient: payload.message.to,
	});

	// TODO: record open tracking analytics for outbound messages.
}

async function handleDomainDNSError(payload: PostalDomainDNSErrorPayload) {
	logPostalWebhook("DomainDNSError", {
		details: payload.dkim_error || payload.mx_error || payload.spf_error,
		domain: payload.domain,
	});

	// TODO: alert when Postal detects outbound DNS drift for a configured domain.
}

export async function handlePostalOutboundWebhookEvent(
	event: PostalOutboundWebhookEvent,
): Promise<void> {
	switch (event.type) {
		case "MessageSent":
			return handleMessageSent(event.payload);
		case "MessageDelayed":
			return handleMessageDelayed(event.payload);
		case "MessageDeliveryFailed":
			return handleMessageDeliveryFailed(event.payload);
		case "MessageHeld":
			return handleMessageHeld(event.payload);
		case "MessageBounced":
			return handleMessageBounced(event.payload);
		case "MessageLinkClicked":
			return handleMessageLinkClicked(event.payload);
		case "MessageLoaded":
			return handleMessageLoaded(event.payload);
		case "DomainDNSError":
			return handleDomainDNSError(event.payload);
	}
}
