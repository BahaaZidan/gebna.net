import { eq } from "drizzle-orm";
import PostalMime, { type Email } from "postal-mime";
import { ulid } from "ulid";
import { filterXSS } from "xss";

import { getDB, TransactionInstance } from "../lib/db";
import { messageTable, threadTable } from "../lib/db/schema";
import { increment } from "../lib/db/utils";
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

		const thread = await findOrCreateThread({
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
	if (replyThread) return incrementThreadUnreadCount(tx, replyThread);

	const referenceIds = parseReferences(parsedEmail.references);
	for (const referenceId of referenceIds) {
		const referenceThread = await getThreadFromMessageId(tx, recipientId, referenceId);
		if (referenceThread) return incrementThreadUnreadCount(tx, referenceThread);
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

	const message = await tx.query.messageTable.findFirst({
		columns: { threadId: true },
		where: (t, { eq, and }) => and(eq(t.recipientId, recipientId), eq(t.messageId, messageId)),
	});
	if (!message) return null;

	return tx.query.threadTable.findFirst({
		where: (t, { eq, and }) => and(eq(t.id, message.threadId), eq(t.recipientId, recipientId)),
	});
}

async function incrementThreadUnreadCount(
	tx: TransactionInstance,
	thread: typeof threadTable.$inferSelect
) {
	await tx
		.update(threadTable)
		.set({ unreadCount: increment(threadTable.unreadCount), lastMessageAt: new Date() })
		.where(eq(threadTable.id, thread.id));

	return { ...thread, unreadCount: thread.unreadCount + 1, lastMessageAt: new Date() };
}
