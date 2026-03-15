import { dbSchema, type TransactionInstance } from "@gebna/db";
import { type Email } from "postal-mime";

import { extractMessageIdsFromPostalMimeValue } from "./process-email-headers";

/**
 * * This encapsulates the threading.
 * * This does not consider plus addressing. (Can be added later).
 * * It also does not consider Gmail dot stripping. (Can be added partially later. There's no way of doing it with workspace address.)
 */
export async function findOrCreateThread({
	tx,
	ownerId,
	parsedEnvelope,
}: {
	tx: TransactionInstance;
	ownerId: string;
	parsedEnvelope: Email;
}): Promise<typeof dbSchema.emailThreads.$inferSelect> {
	const targetMessageIds = extractMessageIdsFromPostalMimeValue(
		`${parsedEnvelope.inReplyTo || ""} ${parsedEnvelope.references || ""}`
	);
	let pastMessage = targetMessageIds.length
		? await tx.query.emailMessages.findFirst({
				where: {
					ownerId,
					canonicalMessageId: { in: targetMessageIds },
				},
				columns: {},
				with: { thread: true },
			})
		: null;
	if (pastMessage?.thread) return pastMessage.thread;

	const [newThread] = await tx
		.insert(dbSchema.emailThreads)
		.values({
			ownerId,
			title: parsedEnvelope.subject,
		})
		.returning();

	return newThread;
}
