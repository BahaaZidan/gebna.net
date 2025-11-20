import { and, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";

import { getDB } from "../../db";
import {
	attachmentTable,
	blobTable,
	mailboxTable,
	messageTable,
	uploadTable,
} from "../../db/schema";

const ORPHANED_BLOB_BATCH = 25;

export async function cleanupExpiredUploadTokens(
	db: ReturnType<typeof getDB>,
	now: Date
): Promise<void> {
	await db.delete(uploadTable).where(lt(uploadTable.expiresAt, now));
}

export async function cleanupExpiredUploadTokensForEnv(env: CloudflareBindings): Promise<void> {
	const db = getDB(env);
	const now = new Date();
	await cleanupExpiredUploadTokens(db, now);
}

export async function cleanupOrphanedBlobsForEnv(env: CloudflareBindings): Promise<void> {
	const db = getDB(env);
	const rows = await db
		.select({
			sha256: blobTable.sha256,
			r2Key: blobTable.r2Key,
		})
		.from(blobTable)
		.leftJoin(messageTable, eq(messageTable.rawBlobSha256, blobTable.sha256))
		.leftJoin(attachmentTable, eq(attachmentTable.blobSha256, blobTable.sha256))
		.where(and(isNull(messageTable.id), isNull(attachmentTable.id)))
		.limit(ORPHANED_BLOB_BATCH);

	if (!rows.length) return;

	const shaValues = rows.map((row) => row.sha256);
	await db.delete(blobTable).where(inArray(blobTable.sha256, shaValues));

	await Promise.all(
		rows.map(async (row) => {
			const key = row.r2Key ?? `blob/${row.sha256}`;
			try {
				await env.R2_EMAILS.delete(key);
			} catch (err) {
				console.error("Failed to delete orphaned blob from R2", { key, err });
			}
		})
	);
}

export async function enforceMailboxRoleConstraintsForEnv(env: CloudflareBindings): Promise<void> {
	const db = getDB(env);
	const rows = await db
		.select({
			id: mailboxTable.id,
			accountId: mailboxTable.accountId,
			role: mailboxTable.role,
			createdAt: mailboxTable.createdAt,
		})
		.from(mailboxTable)
		.where(isNotNull(mailboxTable.role))
		.orderBy(mailboxTable.accountId, mailboxTable.role, mailboxTable.createdAt);

	const seen = new Set<string>();
	const duplicates: string[] = [];

	for (const row of rows) {
		if (!row.role) continue;
		const key = `${row.accountId}:${row.role}`;
		if (seen.has(key)) {
			duplicates.push(row.id);
		} else {
			seen.add(key);
		}
	}

	if (!duplicates.length) return;

	await db
		.update(mailboxTable)
		.set({ role: null, updatedAt: new Date() })
		.where(inArray(mailboxTable.id, duplicates));
}
