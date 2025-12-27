import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";

import { getDB } from "$lib/db";
import { attachmentTable, threadTable } from "$lib/db/schema";

export async function scheduledHandler(
	controller: ScheduledController,
	bindings: CloudflareBindings
) {
	switch (controller.cron) {
		case "0 * * * *":
			await trashMailboxGC(bindings);
			break;
		case "30 */6 * * *":
			await attachmentsGC(bindings);
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

async function attachmentsGC(bindings: CloudflareBindings) {
	const db = getDB(bindings);
	const t = attachmentTable;

	// TODO: batching ?
	const orphanAttachments = await db.query.attachmentTable.findMany({
		columns: { id: true, storageKey: true },
		where: (t, { or, isNull }) => or(isNull(t.ownerId), isNull(t.threadId), isNull(t.messageId)),
	});

	await bindings.R2_EMAILS.delete(orphanAttachments.map((a) => a.storageKey));

	await db.delete(t).where(
		inArray(
			t.id,
			orphanAttachments.map((a) => a.id)
		)
	);
}
