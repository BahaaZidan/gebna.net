import { lt } from "drizzle-orm";

import { getDB } from "../../db";
import { uploadTable } from "../../db/schema";

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
