import { DeliveryStatusRecord } from "../types";

type StatusMap = Record<string, DeliveryStatusRecord>;

const DELIVERED_STATES = new Set(["queued", "yes", "no", "unknown"] as const);
const DISPLAYED_STATES = new Set(["unknown", "yes"] as const);

export function formatSmtpReply(code: number, enhancedStatus: string, text: string): string {
	const codeString = Number.isFinite(code) ? String(Math.trunc(code)).padStart(3, "0") : "000";
	const enhanced =
		typeof enhancedStatus === "string" && enhancedStatus.trim().length > 0
			? enhancedStatus.trim()
			: "0.0.0";
	const description = typeof text === "string" ? text.trim() : "";
	return `${codeString} ${enhanced}${description ? ` ${description}` : ""}`;
}

function cloneStatus(record: DeliveryStatusRecord): DeliveryStatusRecord {
	return { ...record };
}

function sanitizeRecipient(value: string): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function createInitialRecord(): DeliveryStatusRecord {
	return {
		smtpReply: null,
		delivered: "queued",
		displayed: "unknown",
	};
}

function isDeliveryStatusRecord(value: unknown): value is DeliveryStatusRecord {
	if (!value || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	const delivered = record.delivered;
	const displayed = record.displayed;
	if (delivered === undefined || typeof delivered !== "string" || !DELIVERED_STATES.has(delivered as never)) {
		return false;
	}
	if (displayed === undefined || typeof displayed !== "string" || !DISPLAYED_STATES.has(displayed as never)) {
		return false;
	}
	const smtpReply = record.smtpReply;
	if (smtpReply !== null && smtpReply !== undefined && typeof smtpReply !== "string") {
		return false;
	}
	return true;
}

function isLegacyStatusRecord(value: unknown): value is Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const record = value as Record<string, unknown>;
	return typeof record.status === "string";
}

function convertLegacyRecord(value: Record<string, unknown>): DeliveryStatusRecord | null {
	const status = typeof value.status === "string" ? value.status : null;
	if (!status) return null;
	const reason = typeof value.reason === "string" ? value.reason : null;
	const permanent = value.permanent === true;
	const providerMessageId =
		typeof value.providerMessageId === "string" ? value.providerMessageId : undefined;
	const providerRequestId =
		typeof value.providerRequestId === "string" ? value.providerRequestId : undefined;

	let delivered: DeliveryStatusRecord["delivered"] = "queued";
	if (status === "accepted" || status === "pending") {
		delivered = "queued";
	} else if (status === "rejected" || status === "failed") {
		delivered = permanent ? "no" : "queued";
	}

	const smtpReply =
		reason === null
			? null
			: formatSmtpReply(permanent ? 550 : 451, permanent ? "5.0.0" : "4.0.0", reason);

	return {
		smtpReply,
		delivered,
		displayed: "unknown",
		providerMessageId,
		providerRequestId,
	};
}

function coerceRecord(value: unknown): DeliveryStatusRecord | null {
	if (isDeliveryStatusRecord(value)) {
		return cloneStatus(value);
	}
	if (isLegacyStatusRecord(value)) {
		return convertLegacyRecord(value);
	}
	return null;
}

function cloneMap(map: StatusMap): StatusMap {
	const next: StatusMap = {};
	for (const [key, value] of Object.entries(map)) {
		const coerced = coerceRecord(value);
		if (!coerced) continue;
		next[key] = coerced;
	}
	return next;
}

function ensureMap(value: unknown): StatusMap | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}

	const entries = Object.entries(value);
	if (entries.length === 0) return {};

	const sampledValue = entries[0]?.[1];
	if (!sampledValue || typeof sampledValue !== "object") {
		return null;
	}

	if (coerceRecord(sampledValue)) {
		const cloned = cloneMap(value as StatusMap);
		if (Object.keys(cloned).length !== entries.length) {
			return null;
		}
		return cloned;
	}

	return null;
}

export function buildInitialDeliveryStatusMap(recipients: string[]): StatusMap {
	const map: StatusMap = {};
	for (const recipient of recipients) {
		const sanitized = sanitizeRecipient(recipient);
		if (!sanitized) continue;
		map[sanitized] = createInitialRecord();
	}
	if (!Object.keys(map).length) {
		map["unknown"] = createInitialRecord();
	}
	return map;
}

export function normalizeDeliveryStatusMap(
	value: unknown,
	fallbackRecipients?: string[] | null
): StatusMap {
	const coerced = ensureMap(value);
	if (coerced) {
		return coerced;
	}

	const converted = coerceRecord(value);
	if (converted) {
		const recipients =
			fallbackRecipients && fallbackRecipients.length ? fallbackRecipients : ["unknown"];
		const map: StatusMap = {};
		for (const recipient of recipients) {
			const sanitized = sanitizeRecipient(recipient);
			if (!sanitized) continue;
			map[sanitized] = cloneStatus(converted);
		}
		if (!Object.keys(map).length) {
			map["unknown"] = cloneStatus(converted);
		}
		return map;
	}

	if (fallbackRecipients && fallbackRecipients.length) {
		return buildInitialDeliveryStatusMap(fallbackRecipients);
	}

	return buildInitialDeliveryStatusMap([]);
}

export function applyDeliveryStatusToRecipients(
	current: StatusMap | null | undefined,
	recipients: string[] | null,
	newStatus: DeliveryStatusRecord
): StatusMap {
	const baseMap = current ? cloneMap(current) : {};
	const normalizedIndex = new Map<string, string>();
	for (const key of Object.keys(baseMap)) {
		normalizedIndex.set(key.toLowerCase(), key);
	}

	const targets: string[] = [];
	if (recipients && recipients.length > 0) {
		for (const recipient of recipients) {
			const sanitized = sanitizeRecipient(recipient);
			if (!sanitized) continue;
			const existingKey = normalizedIndex.get(sanitized.toLowerCase());
			const resolvedKey = existingKey ?? sanitized;
			targets.push(resolvedKey);
			if (!existingKey) {
				normalizedIndex.set(sanitized.toLowerCase(), resolvedKey);
			}
		}
	} else {
		targets.push(...Object.keys(baseMap));
		if (!targets.length) {
			targets.push("unknown");
		}
	}

	for (const key of targets) {
		baseMap[key] = cloneStatus(newStatus);
	}

	return baseMap;
}
