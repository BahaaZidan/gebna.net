import { eq } from "drizzle-orm";
import PostalMime, { type Attachment, type Email } from "postal-mime";
import { ulid } from "ulid";
import { filterXSS } from "xss";

import { generateImagePlaceholder } from "$lib/utils/users";

import { getDB, TransactionInstance } from "../lib/db";
import { address_userTable, attachmentTable, messageTable, threadTable } from "../lib/db/schema";
import { increment } from "../lib/db/utils";
import { extractLocalPart, resolveAvatar } from "../lib/utils/email";

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

	await db.transaction(async (tx) => {
		const user_address =
			(await tx.query.address_userTable.findFirst({
				where: (t, { eq, and }) =>
					and(eq(t.userId, recipientUser.id), eq(t.address, envelope.from)),
			})) ||
			(
				await tx
					.insert(address_userTable)
					.values({
						id: ulid(),
						address: envelope.from,
						userId: recipientUser.id,
						targetMailboxId: (await tx.query.mailboxTable.findFirst({
							where: (t, { eq, and }) =>
								and(eq(t.userId, recipientUser.id), eq(t.type, "screener")),
						}))!.id,
						name: parsedEmail.from!.name,
						avatarPlaceholder: generateImagePlaceholder(parsedEmail.from!.name),
						avatar: await avatarInference,
					})
					.returning()
			)[0];
		const targetMailboxId = user_address.targetMailboxId;
		if (!targetMailboxId) throw new Error("SOMETHING_WENT_WRONG");

		const thread = await findOrCreateThread({
			tx,
			envelope,
			parsedEmail,
			recipientId: recipientUser.id,
			targetMailboxId,
		});

		const createdMessageId = ulid();

		await tx.insert(messageTable).values({
			id: createdMessageId,
			from: envelope.from,
			mailboxId: targetMailboxId,
			recipientId: recipientUser.id,
			threadId: thread.id,
			to: parsedEmail.to?.map((a) => a.address).filter(Boolean),
			cc: parsedEmail.cc?.map((a) => a.address).filter(Boolean),
			bcc: parsedEmail.bcc?.map((a) => a.address).filter(Boolean),
			subject: parsedEmail.subject,
			messageId: parsedEmail.messageId,
			replyTo: parsedEmail.replyTo?.map((a) => a.address).filter(Boolean),
			references: parsedEmail.references,
			inReplyTo: parsedEmail.inReplyTo,
			bodyHTML: parsedEmail.html ? filterXSS(parsedEmail.html) : null,
			bodyText: parsedEmail.text,
			snippet: parsedEmail.text?.slice(0, 50),
			sizeInBytes: envelope.rawSize,
		});

		if (parsedEmail.attachments.length) {
			const attachmentsToInsert = await Promise.all(
				parsedEmail.attachments.map(async (attachment) => {
					const createdAttachmentId = ulid();
					const storageKey = `u/${recipientUser.id}/m/${createdMessageId}/a/${createdAttachmentId}`;

					const body = getAttachmentBody(attachment);
					await bindings.R2_EMAILS.put(storageKey, body, {
						httpMetadata: { contentType: attachment.mimeType },
					});

					return {
						id: createdAttachmentId,
						userId: recipientUser.id,
						messageId: createdMessageId,
						storageKey,
						sizeInBytes: body.byteLength,
						fileName: attachment.filename,
						mimeType: attachment.mimeType,
						disposition: attachment.disposition,
						contentId: attachment.contentId,
					};
				})
			);

			await tx.insert(attachmentTable).values(attachmentsToInsert);
		}
	});
}

async function findOrCreateThread({
	tx,
	envelope,
	targetMailboxId,
	recipientId,
	parsedEmail,
}: {
	tx: TransactionInstance;
	envelope: ForwardableEmailMessage;
	targetMailboxId: string;
	recipientId: string;
	parsedEmail: Email;
}) {
	const replyThread = await getThreadFromMessageId(tx, recipientId, parsedEmail.inReplyTo);
	if (replyThread) return incrementThreadUnseenCount(tx, replyThread);

	const referenceIds = parseReferences(parsedEmail.references);
	for (const referenceId of referenceIds) {
		const referenceThread = await getThreadFromMessageId(tx, recipientId, referenceId);
		if (referenceThread) return incrementThreadUnseenCount(tx, referenceThread);
	}

	const [createdThread] = await tx
		.insert(threadTable)
		.values({
			id: ulid(),
			from: envelope.from,
			mailboxId: targetMailboxId,
			recipientId,
			title: parsedEmail.subject,
			firstMessageSubject: parsedEmail.subject,
			firstMessageId: parsedEmail.messageId,
			snippet: parsedEmail.text?.slice(0, 50),
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
		where: (t, { eq, and }) => and(eq(t.recipientId, recipientId), eq(t.messageId, messageId)),
	});
	if (!message) return null;

	return tx.query.threadTable.findFirst({
		where: (t, { eq, and }) => and(eq(t.id, message.threadId), eq(t.recipientId, recipientId)),
	});
}

async function incrementThreadUnseenCount(
	tx: TransactionInstance,
	thread: typeof threadTable.$inferSelect
) {
	await tx
		.update(threadTable)
		.set({ unseenCount: increment(threadTable.unseenCount), lastMessageAt: new Date() })
		.where(eq(threadTable.id, thread.id));

	return { ...thread, unseenCount: thread.unseenCount + 1, lastMessageAt: new Date() };
}

const utf8Encoder = new TextEncoder();
function getAttachmentBody(attachment: Attachment) {
	const content = attachment.content;
	if (typeof content === "string") {
		if (attachment.encoding === "base64") {
			const binary = atob(content);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
			return bytes;
		}
		return utf8Encoder.encode(content);
	}
	if (content instanceof ArrayBuffer) return content;
	return new Uint8Array();
}
