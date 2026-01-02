import { eq } from "drizzle-orm";
import PostalMime, { type Email } from "postal-mime";
import { ulid } from "ulid";

import {
	AttachmentInsertModel,
	getDB,
	MailboxSelectModel,
	ThreadParticipantInsertModel,
	ThreadSelectModel,
	TransactionInstance,
} from "$lib/db";
import {
	attachmentTable,
	contactTable,
	messageTable,
	threadParticipantTable,
	threadTable,
} from "$lib/db/schema";
import { increment } from "$lib/db/utils";
import { extractLocalPart, resolveAvatar } from "$lib/utils/email";
import { buildCidResolver, getAttachmentBytes } from "$lib/utils/email-attachments";
import { normalizeAndSanitizeEmailBody } from "$lib/utils/email-html-normalization";
import type { ThumbnailQueueMessage } from "$lib/thumbnails/queue";
import { generateImagePlaceholder } from "$lib/utils/users";

export async function emailHandler(
	envelope: ForwardableEmailMessage,
	bindings: CloudflareBindings,
	_context: ExecutionContext
) {
	const db = getDB(bindings);

	const recipientUser = await db.query.userTable.findFirst({
		where: (t, { eq }) => eq(t.username, extractLocalPart(envelope.to)),
	});
	if (!recipientUser) return envelope.setReject("ADDRESS NOT FOUND!");

	const parsedEmail = await PostalMime.parse(envelope.raw);
	if (!parsedEmail.from?.name) return envelope.setReject("FROM NOT SET!");

	const avatarInference = resolveAvatar(db, envelope.from).catch(() => undefined);
	const cidResolver = buildCidResolver(parsedEmail.attachments);
	const normalizedBody = normalizeAndSanitizeEmailBody(parsedEmail, {
		cidResolver,
		blockRemoteImagesByDefault: false,
		allowDataImages: Boolean(cidResolver),
	});
	const snippet = normalizedBody.text.trim() ? normalizedBody.text.slice(0, 50) : null;

	await db.transaction(async (tx) => {
		const contact =
			(await tx.query.contactTable.findFirst({
				where: (t, { eq, and }) =>
					and(eq(t.ownerId, recipientUser.id), eq(t.address, envelope.from)),
			})) ||
			(
				await tx
					.insert(contactTable)
					.values({
						id: ulid(),
						address: envelope.from,
						ownerId: recipientUser.id,
						targetMailboxId: (await tx.query.mailboxTable.findFirst({
							where: (t, { eq, and }) =>
								and(eq(t.userId, recipientUser.id), eq(t.type, "screener")),
						}))!.id,
						targetMailboxType: "screener",
						name: parsedEmail.from!.name,
						avatarPlaceholder: generateImagePlaceholder(parsedEmail.from!.name),
						avatar: await avatarInference,
					})
					.returning()
			)[0];
		const targetMailboxId = contact.targetMailboxId;
		if (!targetMailboxId) throw new Error("SOMETHING_WENT_WRONG");

		const targetMailbox = await tx.query.mailboxTable.findFirst({
			where: (t, { eq }) => eq(t.id, targetMailboxId),
		});
		if (!targetMailbox) throw new Error("SOMETHING_WENT_WRONG");
		const unseen = targetMailbox.type === "important" || targetMailbox.type === "screener";

		const thread = await findOrCreateThread({
			tx,
			envelope,
			parsedEmail,
			recipientId: recipientUser.id,
			targetMailbox,
			unseen,
		});

		const to = parsedEmail.to?.map((a) => a.address).filter(Boolean) || [];
		const cc = parsedEmail.cc?.map((a) => a.address).filter(Boolean) || [];
		const bcc = parsedEmail.bcc?.map((a) => a.address).filter(Boolean) || [];
		const replyTo = parsedEmail.replyTo?.map((a) => a.address).filter(Boolean) || [];

		const createdMessageId = ulid();
		await tx.insert(messageTable).values({
			id: createdMessageId,
			from: envelope.from,
			mailboxId: targetMailboxId,
			ownerId: recipientUser.id,
			threadId: thread.id,
			to,
			cc,
			bcc,
			replyTo,
			subject: parsedEmail.subject,
			messageId: parsedEmail.messageId,
			references: parsedEmail.references,
			inReplyTo: parsedEmail.inReplyTo,
			bodyHTML: normalizedBody.htmlDocument,
			bodyText: normalizedBody.text,
			snippet,
			sizeInBytes: envelope.rawSize,
			unseen,
		});

		const participantAddresses = new Set<string>([envelope.from, ...to, ...cc, ...bcc, ...replyTo]);

		tx.insert(threadParticipantTable)
			.values(
				Array.from(participantAddresses).map(
					(address) =>
						({
							address,
							ownerId: recipientUser.id,
							threadId: thread.id,
						}) satisfies ThreadParticipantInsertModel
				)
			)
			.onConflictDoNothing();

		if (parsedEmail.attachments.length) {
			const attachmentsToInsert = await Promise.all(
				parsedEmail.attachments.map(async (attachment) => {
					const createdAttachmentId = ulid();
					const storageKey = `u/${recipientUser.id}/m/${createdMessageId}/a/${createdAttachmentId}`;

					const body = getAttachmentBytes(attachment);
					await bindings.R2_EMAILS.put(storageKey, body, {
						httpMetadata: { contentType: attachment.mimeType },
					});

					return {
						id: createdAttachmentId,
						ownerId: recipientUser.id,
						threadId: thread.id,
						messageId: createdMessageId,
						messageFrom: envelope.from,
						storageKey,
						sizeInBytes: body.byteLength,
						fileName: attachment.filename,
						mimeType: attachment.mimeType,
						disposition: attachment.disposition,
						contentId: attachment.contentId,
					} satisfies AttachmentInsertModel;
				})
			);

			await tx.insert(attachmentTable).values(attachmentsToInsert);

			const thumbnailMessages: ThumbnailQueueMessage[] = attachmentsToInsert.map((attachment) => ({
				storageKey: attachment.storageKey,
				mimeType: attachment.mimeType,
				filename: attachment.fileName ?? null,
			}));

			await bindings.THUMBNAIL_QUEUE.sendBatch(
				thumbnailMessages.map((message) => ({
					body: message,
					contentType: "json",
				}))
			);
		}
	});
}

async function findOrCreateThread({
	tx,
	envelope,
	targetMailbox,
	unseen,
	recipientId,
	parsedEmail,
}: {
	tx: TransactionInstance;
	envelope: ForwardableEmailMessage;
	targetMailbox: MailboxSelectModel;
	unseen: boolean;
	recipientId: string;
	parsedEmail: Email;
}) {
	const replyThread = await getThreadFromMessageId(tx, recipientId, parsedEmail.inReplyTo);
	if (replyThread) return incrementThreadUnseenCount(tx, replyThread, unseen);

	const referenceIds = parseReferences(parsedEmail.references);
	for (const referenceId of referenceIds) {
		const referenceThread = await getThreadFromMessageId(tx, recipientId, referenceId);
		if (referenceThread) return incrementThreadUnseenCount(tx, referenceThread, unseen);
	}

	const [createdThread] = await tx
		.insert(threadTable)
		.values({
			id: ulid(),
			firstMessageFrom: envelope.from,
			mailboxId: targetMailbox.id,
			mailboxType: targetMailbox.type,
			ownerId: recipientId,
			title: parsedEmail.subject,
			firstMessageSubject: parsedEmail.subject,
			firstMessageId: parsedEmail.messageId,
			snippet: parsedEmail.text?.slice(0, 50),
			unseenCount: unseen ? 1 : 0,
			trashAt: targetMailbox.type === "trash" ? new Date() : null,
		})
		.returning();

	return createdThread;
}

function parseReferences(references?: string | null) {
	if (!references?.trim()) return [];

	const validHeader = /^(\s*<[^<>\s@]+@[^<>\s@]+>\s*)+$/;
	if (!validHeader.test(references)) return [];

	const matches = references.matchAll(/<([^<>]+)>/g);
	return Array.from(matches, (match) => match[1]);
}

async function getThreadFromMessageId(
	tx: TransactionInstance,
	recipientId: string,
	messageId?: string | null
) {
	if (!messageId) return null;

	const message = await tx.query.messageTable.findFirst({
		columns: { threadId: true },
		where: (t, { eq, and }) => and(eq(t.ownerId, recipientId), eq(t.messageId, messageId)),
	});
	if (!message) return null;

	return tx.query.threadTable.findFirst({
		where: (t, { eq, and }) => and(eq(t.id, message.threadId), eq(t.ownerId, recipientId)),
	});
}

async function incrementThreadUnseenCount(
	tx: TransactionInstance,
	thread: ThreadSelectModel,
	unseen: boolean
) {
	const lastMessageAt = new Date();
	await tx
		.update(threadTable)
		.set({
			...(unseen ? { unseenCount: increment(threadTable.unseenCount) } : {}),
			lastMessageAt,
		})
		.where(eq(threadTable.id, thread.id));

	return {
		...thread,
		unseenCount: unseen ? thread.unseenCount + 1 : thread.unseenCount,
		lastMessageAt,
	};
}
