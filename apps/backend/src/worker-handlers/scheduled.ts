import { and, eq, isNotNull, lte } from "drizzle-orm";

import { getDB } from "$lib/db";
import { threadTable } from "$lib/db/schema";

export async function scheduledHandler(
	controller: ScheduledController,
	bindings: CloudflareBindings
) {
	switch (controller.cron) {
		case "0 * * * *":
			await trashMailboxGC(bindings);
			break;
		default:
			break;
	}
}

async function trashMailboxGC(bindings: CloudflareBindings) {
	const db = getDB(bindings);
	const t = threadTable;
	const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
	const trashCutoff = new Date(Date.now() - SEVEN_DAYS_MS);

	// TODO: maybe do it in batches of 500 or something ?
	await db
		.delete(t)
		.where(and(eq(t.mailboxType, "trash"), isNotNull(t.trashAt), lte(t.trashAt, trashCutoff)));
}
