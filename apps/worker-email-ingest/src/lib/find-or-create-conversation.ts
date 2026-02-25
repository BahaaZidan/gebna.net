import { dbSchema, type TransactionInstance } from "@gebna/db";
import { type EmailConversationKind } from "@gebna/db/schema";
import { type Email } from "postal-mime";

import { extractMessageIdsFromPostalMimeValue } from "./process-email-headers";

/**
 * * This encapsulates the threading.
 * * Conversational for 1-1 messages. Classical email threading otherwise.
 * *
 * * This does not consider plus addressing. (Can be added later).
 * * It also does not consider Gmail dot stripping. (Can be added partially later. There's no way of doing it with workspace address.)
 * * This disregards aliases. A weird behaviour can arise when a user recieves a message from "support@example.com" only to reply to/get a reply from another address which creates another conversation. Which aligns with DMing UX but not with Emailing UX.
 */
export async function findOrCreateConversation({
	tx,
	ownerId,
	parsedEnvelope,
	uniqueParticipants,
}: {
	tx: TransactionInstance;
	ownerId: string;
	parsedEnvelope: Email;
	uniqueParticipants: dbSchema.EmailMessageMetadataAddress[];
}): Promise<typeof dbSchema.emailConversations.$inferSelect> {
	const kind: EmailConversationKind = uniqueParticipants.length === 2 ? "PRIVATE" : "GROUP";

	if (kind === "PRIVATE") {
		const privateConvoKey = uniqueParticipants
			.map((p) => p.address)
			.sort()
			.join(":");
		const pastConvo = await tx.query.emailConversations.findFirst({
			where: {
				ownerId,
				privateConvoKey,
			},
		});
		if (pastConvo) return pastConvo;

		const [newConvo] = await tx
			.insert(dbSchema.emailConversations)
			.values({
				ownerId,
				kind,
				privateConvoKey,
				title: parsedEnvelope.subject,
			})
			.returning();
		return newConvo;
	}

	const targetMessageIds = extractMessageIdsFromPostalMimeValue(
		`${parsedEnvelope.inReplyTo || ""} ${parsedEnvelope.references || ""}`
	);
	let pastMessage = targetMessageIds.length
		? await tx.query.emailMessages.findFirst({
				where: {
					ownerId,
					canonicalMessageId: { in: targetMessageIds },
					conversation: {
						kind: "GROUP",
					},
				},
				columns: {},
				with: { conversation: true },
			})
		: null;
	if (pastMessage?.conversation) return pastMessage.conversation;

	const [newConvo] = await tx
		.insert(dbSchema.emailConversations)
		.values({
			ownerId,
			kind,
			title: parsedEnvelope.subject,
		})
		.returning();

	return newConvo;
}
