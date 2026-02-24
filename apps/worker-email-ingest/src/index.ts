import { dbSchema, getDB, increment, type TransactionInstance } from "@gebna/db";
import type {
	EmailConversationKind,
	EmailMessageMetadata,
	EmailMessageMetadataAddress,
} from "@gebna/db/schema";
import { generateImagePlaceholder, R } from "@gebna/utils";
import PostalMime, { Address, Email } from "postal-mime";

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
		if (!recipientUser) return envelope.setReject("NOT_FOUND");

		let fromAddressRef = recipientUser.emailAddressRefs[0];
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

				return { ...addressRef, address_ };
			});
			// TODO: enqueue address avatar inference here based on emailAddresses.updatedAt and createdAt
		}
		const processedBody = await processEmailBody({ email: parsedEnvelope });
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
	envelope,
	parsedEnvelope,
}: {
	tx: TransactionInstance;
	ownerId: string;
	envelope: ForwardableEmailMessage;
	parsedEnvelope: Email;
}): Promise<typeof dbSchema.emailConversations.$inferSelect> {
	const { to, cc } = getEmailMessageMetadata(parsedEnvelope);
	const participants = [
		...to,
		...cc,
		{ address: envelope.to, name: "" },
		{ address: envelope.from, name: "" },
	];
	const uniqueParticipants = R.uniqBy((p) => p.address, participants);
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
