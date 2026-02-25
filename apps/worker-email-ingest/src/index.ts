import { dbSchema, eq, getDB, increment, type TransactionInstance } from "@gebna/db";
import type {
	EmailConversationKind,
	EmailMessageMetadata,
	EmailMessageMetadataAddress,
} from "@gebna/db/schema";
import { generateImagePlaceholder, R } from "@gebna/utils";
import PostalMime, { Email } from "postal-mime";

import { processEmailBody } from "$lib/process-email-body";
import { extractMessageIdsFromPostalMimeValue } from "$lib/process-email-headers";

export default {
	fetch() {
		return new Response(`Running in ${navigator.userAgent}! LOLOooooooo`);
	},
	async email(envelope, env, ctx) {
		// TODO: maybe a good place to use never-throw ?
		const parsedEnvelope = await PostalMime.parse(envelope.raw, {
			rfc822Attachments: true,
			attachmentEncoding: "arraybuffer",
		});
		if (!parsedEnvelope.from || !parsedEnvelope.from.address) return envelope.setReject("INVALID");
		const db = getDB({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
		const recipientUser = await db.query.users.findFirst({
			with: {
				ownAddressRef: true,
				emailAddressRefs: {
					limit: 1,
					where: {
						address: envelope.from,
					},
					with: {
						address_: true,
					},
				},
			},
			where: {
				email: envelope.to,
			},
		});
		if (!recipientUser || !recipientUser.ownAddressRef) return envelope.setReject("NOT_FOUND");
		const participantsRefs = [recipientUser.ownAddressRef];

		let [fromAddressRef] = recipientUser.emailAddressRefs;
		if (fromAddressRef) {
			if (fromAddressRef.isSpam) return envelope.setReject("SPAM");
			if (fromAddressRef.isBlocked) return;
		} else {
			fromAddressRef = await db.transaction(async (tx) => {
				const [address_] = await tx
					.insert(dbSchema.emailAddresses)
					.values({
						address: envelope.from,
						name: parsedEnvelope.from!.name,
						avatarPlaceholder: generateImagePlaceholder(parsedEnvelope.from!.name),
					})
					.returning()
					.onConflictDoNothing();

				const [addressRef] = await tx
					.insert(dbSchema.emailAddressRefs)
					.values({
						ownerId: recipientUser.id,
						address: envelope.from,
					})
					.returning();

				participantsRefs.push(addressRef);

				return { ...addressRef, address_ };
			});
			// TODO: enqueue address avatar inference here based on emailAddresses.updatedAt and createdAt
		}

		const processedBody = await processEmailBody({ email: parsedEnvelope });
		const [canonicalMessageId] = extractMessageIdsFromPostalMimeValue(parsedEnvelope.messageId);
		const messageMetadata = getEmailMessageMetadata(parsedEnvelope);
		const participants = [
			...messageMetadata.to,
			...messageMetadata.cc,
			{ address: envelope.to, name: "" },
			{ address: envelope.from, name: "" },
		];
		const uniqueParticipants = R.uniqBy((p) => p.address, participants);
		await db.transaction(async (tx) => {
			const ownerId = recipientUser.id;
			const conversation = await findOrCreateConversation({
				tx,
				ownerId,
				uniqueParticipants,
				parsedEnvelope,
			});

			const [message] = await tx
				.insert(dbSchema.emailMessages)
				.values({
					ownerId,
					conversationId: conversation.id,
					sizeInBytes: envelope.rawSize,
					canonicalMessageId,
					bodyHTML: processedBody?.html,
					bodyPlaintext: processedBody?.plaintext,
					metadata: messageMetadata,
					from: envelope.from,
					to: envelope.to,
				})
				.returning();

			await tx
				.update(dbSchema.emailConversations)
				.set({
					unseenCount: increment(dbSchema.emailConversations.unseenCount),
					lastMessageAt: new Date(),
					lastMessageId: message.id,
				})
				.where(eq(dbSchema.emailConversations.id, conversation.id));

			if (parsedEnvelope.attachments.length) {
				await tx.insert(dbSchema.emailAttachments).values(
					parsedEnvelope.attachments.map(
						(a) =>
							({
								ownerId,
								conversationId: conversation.id,
								messageId: message.id,
								fromRef: fromAddressRef.id,
								content: a.content,
								contentId: a.contentId,
								description: a.description,
								disposition: a.disposition,
								method: a.method,
								// TODO: don't trust the provided mimeType. check magic bytes instead
								mimeType: a.mimeType,
								filename: a.filename,
								related: a.related,
							}) satisfies typeof dbSchema.emailAttachments.$inferInsert
					)
				);
			}

			const secondaryUniqueParticipants = uniqueParticipants.filter(
				(p) => ![envelope.from, envelope.to].includes(p.address)
			);
			if (secondaryUniqueParticipants.length) {
				await tx
					.insert(dbSchema.emailAddresses)
					.values(
						secondaryUniqueParticipants.map(
							(p) =>
								({
									address: p.address,
									name: p.name,
									avatarPlaceholder: generateImagePlaceholder(p.name || p.address),
								}) satisfies typeof dbSchema.emailAddresses.$inferInsert
						)
					)
					.onConflictDoNothing();
				const secondaryRefs = await tx
					.insert(dbSchema.emailAddressRefs)
					.values(
						secondaryUniqueParticipants.map(
							(p) =>
								({
									ownerId,
									address: p.address,
								}) satisfies typeof dbSchema.emailAddressRefs.$inferInsert
						)
					)
					.returning()
					.onConflictDoNothing();

				participantsRefs.push(...secondaryRefs);
			}

			await tx.insert(dbSchema.emailConversationParticipants).values(
				participantsRefs.map(
					(ref) =>
						({
							conversationId: conversation.id,
							emailAddressRefId: ref.id,
						}) satisfies typeof dbSchema.emailConversationParticipants.$inferInsert
				)
			);
		});

		/**
		 * TODOs after transaction:
		 * * enqueue address avatar inference
		 * * [?] enqueue attachment thumbnail generation
		 */
	},
} satisfies ExportedHandler<Env>;

function getEmailMessageMetadata(parsedEnvelope: Email): EmailMessageMetadata {
	const to = (parsedEnvelope.to?.filter((a) => !!a.address) ?? []) as EmailMessageMetadataAddress[];
	const cc = (parsedEnvelope.cc?.filter((a) => !!a.address) ?? []) as EmailMessageMetadataAddress[];
	const bcc = (parsedEnvelope.bcc?.filter((a) => !!a.address) ??
		[]) as EmailMessageMetadataAddress[];
	const replyTo = (parsedEnvelope.replyTo?.filter((a) => !!a.address) ??
		[]) as EmailMessageMetadataAddress[];

	return {
		to,
		bcc,
		cc,
		replyTo,
		inReplyTo: parsedEnvelope.inReplyTo,
		references: parsedEnvelope.references,
	};
}

/**
 * * This encapsulates the threading.
 * * Conversational for 1-1 messages. Classical email threading otherwise.
 * *
 * * This does not consider plus addressing. (Can be added later).
 * * It also does not consider Gmail dot stripping. (Can be added partially later. There's no way of doing it with workspace address.)
 * * This disregards aliases. A weird behaviour can arise when a user recieves a message from "support@example.com" only to reply to/get a reply from another address which creates another conversation. Which aligns with DMing UX but not with Emailing UX.
 */
async function findOrCreateConversation({
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
