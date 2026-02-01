import { and, desc, inArray, isNotNull, sql } from "drizzle-orm";
import type { Address } from "postal-mime";
import { ulid } from "ulid";

import { getDB, type IdentityInsertModel, type TransactionInstance } from "$lib/db";
import { identityTable } from "$lib/db/schema";
import { generateImagePlaceholder } from "$lib/utils/users";

export function extractMessageIds(headerValue?: string | null): string[] {
	if (!headerValue) return [];
	const matches =
		headerValue
			.match(/<[^>]+>/g)
			?.map((m) => m.trim())
			.filter(Boolean) ?? [];
	if (matches.length) return matches;
	const fallback = headerValue.trim();
	return fallback ? [fallback] : [];
}

type IdentitySelect = typeof identityTable.$inferSelect;
export async function ensureIdentities(
	db: ReturnType<typeof getDB>,
	addresses: Address[]
): Promise<IdentitySelect[]> {
	const unique = new Map<string, { address: string; name: string }>();

	for (const address of addresses) {
		const rawAddress = address.address?.trim();
		if (!rawAddress) continue;
		const key = rawAddress.toLowerCase();
		const name = address.name?.trim() ?? "";
		const existing = unique.get(key);
		if (!existing || (!existing.name && name)) {
			unique.set(key, { address: rawAddress, name });
		}
	}

	const requestedAddresses = Array.from(unique.values());
	if (!requestedAddresses.length) return [];

	const existingRows = await db.query.identityTable.findMany({
		where: (t, { inArray }) =>
			inArray(
				t.address,
				requestedAddresses.map((item) => item.address)
			),
	});
	const existingByAddress = new Map(
		existingRows.map((row) => [row.address.toLowerCase(), row])
	);

	const toInsert: IdentityInsertModel[] = [];
	for (const entry of requestedAddresses) {
		if (existingByAddress.has(entry.address.toLowerCase())) continue;
		const display = entry.name || entry.address;
		toInsert.push({
			id: ulid(),
			address: entry.address,
			kind: "EXTERNAL_EMAIL",
			name: entry.name,
			avatarPlaceholder: generateImagePlaceholder(display),
		});
	}

	if (toInsert.length) {
		await db
			.insert(identityTable)
			.values(toInsert)
			.onConflictDoNothing({ target: identityTable.address });
	}

	const rows = await db.query.identityTable.findMany({
		where: (t) =>
			sql`
				(${t.address})
				IN (
					VALUES ${sql.join(
						requestedAddresses.map((item) => sql`(${item.address})`),
						sql`, `
					)}
				)
			`,
	});

	if (rows.length !== requestedAddresses.length) {
		throw new Error("Failed to ensure identities");
	}
	return rows;
}

export async function findConversationIdByEmailThreadMessageIds(
	db: TransactionInstance | ReturnType<typeof getDB>,
	threadMessageIds: string[]
): Promise<string | null> {
	if (!threadMessageIds.length) return null;
	const row = await db.query.messageTable.findFirst({
		columns: { conversationId: true },
		where: (t) =>
			and(isNotNull(t.externalMessageId), inArray(t.externalMessageId, threadMessageIds)),
		orderBy: (t) => [desc(t.createdAt)],
	});

	return row?.conversationId ?? null;
}
