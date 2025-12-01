import { eq } from "drizzle-orm";
import PostalMime, { type Email } from "postal-mime";
import { ulid } from "ulid";

import { getDB, TransactionInstance } from "../lib/db";
import { messageTable, threadTable } from "../lib/db/schema";
import { extractLocalPart } from "../lib/utils/email";

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

	await db.transaction(async (tx) => {
		const user_address = await tx.query.address_userTable.findFirst({
			where: (t, { eq, and }) => and(eq(t.userId, recipientUser.id), eq(t.address, envelope.from)),
		});
		const targetMailboxId = user_address
			? user_address.targetMailboxId
			: (
					await tx.query.mailboxTable.findFirst({
						where: (t, { eq, and }) => and(eq(t.userId, recipientUser.id), eq(t.type, "screener")),
					})
				)?.id;
		if (!targetMailboxId) throw new Error("SOMETHING_WENT_WRONG");

		const parsedEmail = await PostalMime.parse(envelope.raw);

		const createdThread = await findOrCreateThread({
			tx,
			envelope,
			parsedEmail,
			recipientId: recipientUser.id,
			targetMailboxId,
		});

		await tx.insert(messageTable).values({
			id: ulid(),
			from: envelope.from,
			mailboxId: targetMailboxId,
			recipientId: recipientUser.id,
			threadId: createdThread.id,
			to: parsedEmail.to?.map((a) => a.address).filter(Boolean),
			cc: parsedEmail.cc?.map((a) => a.address).filter(Boolean),
			bcc: parsedEmail.bcc?.map((a) => a.address).filter(Boolean),
			subject: parsedEmail.subject,
			messageId: parsedEmail.messageId,
			references: parsedEmail.references,
			replyTo: parsedEmail.replyTo?.map((a) => a.address).filter(Boolean),
			inReplyTo: parsedEmail.inReplyTo,
			bodyHTML: parsedEmail.html,
			bodyText: parsedEmail.text,
			snippet: parsedEmail.text?.slice(0, 50),
		});
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
	if (replyThread) return bumpThread(tx, replyThread);

	const referenceIds = parseReferences(parsedEmail.references);
	for (const referenceId of referenceIds) {
		const referenceThread = await getThreadFromMessageId(tx, recipientId, referenceId);
		if (referenceThread) return bumpThread(tx, referenceThread);
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

	const parentMessage = await tx.query.messageTable.findFirst({
		where: (t, { eq, and }) => and(eq(t.recipientId, recipientId), eq(t.messageId, messageId)),
	});
	if (!parentMessage) return null;

	return tx.query.threadTable.findFirst({
		where: (t, { eq, and }) =>
			and(eq(t.id, parentMessage.threadId), eq(t.recipientId, recipientId)),
	});
}

async function bumpThread(tx: TransactionInstance, thread: typeof threadTable.$inferSelect) {
	const unreadCount = thread.unreadCount + 1;

	await tx
		.update(threadTable)
		.set({ unreadCount, lastMessageAt: new Date() })
		.where(eq(threadTable.id, thread.id));

	return { ...thread, unreadCount, lastMessageAt: new Date() };
}
