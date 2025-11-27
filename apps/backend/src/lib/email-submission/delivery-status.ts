import { DeliveryStatusRecord } from "../types";

type StatusMap = Record<string, DeliveryStatusRecord>;

function cloneStatus(record: DeliveryStatusRecord): DeliveryStatusRecord {
	return { ...record };
}

function sanitizeRecipient(value: string): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function createPendingRecord(): DeliveryStatusRecord {
	return {
		status: "pending",
		lastAttempt: 0,
		retryCount: 0,
	};
}

function isDeliveryStatusRecord(value: unknown): value is DeliveryStatusRecord {
	if (!value || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	if (!["pending", "accepted", "rejected", "failed"].includes(String(record.status))) {
		return false;
	}
	if (typeof record.lastAttempt !== "number" || !Number.isFinite(record.lastAttempt)) {
		return false;
	}
	if (typeof record.retryCount !== "number" || !Number.isFinite(record.retryCount)) {
		return false;
	}
	return true;
}

function cloneMap(map: StatusMap): StatusMap {
	const next: StatusMap = {};
	for (const [key, value] of Object.entries(map)) {
		if (!isDeliveryStatusRecord(value)) continue;
		next[key] = cloneStatus(value);
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

	if (isDeliveryStatusRecord(sampledValue)) {
		// Need to make sure every entry is a DeliveryStatusRecord.
		const allRecords = entries.every(([, entry]) => isDeliveryStatusRecord(entry));
		if (!allRecords) {
			return null;
		}
		return cloneMap(value as StatusMap);
	}

	return null;
}

export function buildInitialDeliveryStatusMap(recipients: string[]): StatusMap {
	const map: StatusMap = {};
	for (const recipient of recipients) {
		const sanitized = sanitizeRecipient(recipient);
		if (!sanitized) continue;
		map[sanitized] = createPendingRecord();
	}
	if (!Object.keys(map).length) {
		map["unknown"] = createPendingRecord();
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

	if (isDeliveryStatusRecord(value)) {
		const recipients =
			fallbackRecipients && fallbackRecipients.length ? fallbackRecipients : ["unknown"];
		const map: StatusMap = {};
		for (const recipient of recipients) {
			const sanitized = sanitizeRecipient(recipient);
			if (!sanitized) continue;
			map[sanitized] = cloneStatus(value);
		}
		if (!Object.keys(map).length) {
			map["unknown"] = cloneStatus(value);
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
