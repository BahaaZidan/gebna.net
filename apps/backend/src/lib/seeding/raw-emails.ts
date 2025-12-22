import { and, eq, inArray } from "drizzle-orm";
import PostalMime from "postal-mime";
import { ulid } from "ulid";

import { getDB, type TransactionInstance } from "$lib/db";
import * as schema from "$lib/db/schema";
import { increment } from "$lib/db/utils";
import { buildCidResolver } from "$lib/utils/email-attachments";
import { normalizeAndSanitizeEmailBody } from "$lib/utils/email-html-normalization";
import { generateImagePlaceholder } from "$lib/utils/users";

type SeedEmail = {
	fileName: string;
	raw: Uint8Array;
	fromAddress: string;
	fromName: string;
	createdAt: Date;
	bodyText: string | null;
	bodyHTML: string | null | undefined;
	snippet: string | null;
	subject: string | null;
	references?: string | null;
	inReplyTo?: string | null;
	messageId: string;
	cc?: string[];
	bcc?: string[];
	replyTo?: string[];
};

export type SeedRawEmailOptions = {
	reset?: boolean;
	recipientUsername?: string;
	recipientEmail?: string;
};

export type SeedRawEmailResult = {
	status: "ok";
	resetPerformed: boolean;
	recipientUsername: string;
	recipientEmail: string;
	counts: {
		filesProcessed: number;
		filesSkipped: number;
		messagesInserted: number;
		messagesSkipped: number;
		threadsDeleted?: number;
		contactsDeleted?: number;
		deletedMessages?: number;
	};
};

const rawEmailModules = import.meta.glob("./data/raw-emails/*.eml", {
	as: "raw",
	eager: true,
});

const encoder = new TextEncoder();

export async function seedRawEmails(
	env: CloudflareBindings,
	options: SeedRawEmailOptions = {}
): Promise<SeedRawEmailResult> {
	const recipientUsername = options.recipientUsername ?? "demo";
	const recipientEmail = options.recipientEmail ?? `${recipientUsername}@gebna.net`;

	const db = getDB(env);
	const recipient = await db.query.userTable.findFirst({
		where: (t, { eq }) => eq(t.username, recipientUsername),
	});
	if (!recipient) {
		throw new Error(`User "${recipientUsername}" not found. Seed the demo user first.`);
	}

	const mailboxes = await db.query.mailboxTable.findMany({
		where: (t, { eq }) => eq(t.userId, recipient.id),
	});
	const mailboxById = new Map(mailboxes.map((mailbox) => [mailbox.id, mailbox]));
	const screenerMailbox = mailboxes.find((mailbox) => mailbox.type === "screener");
	if (!screenerMailbox) {
		throw new Error(`Missing screener mailbox for user "${recipientUsername}".`);
	}

	const { seedEmails, skippedFiles, files } = await loadSeedEmails();

	let inserted = 0;
	let skipped = 0;
	let resetResult: Awaited<ReturnType<typeof deleteSeededRecords>> | undefined;

	if (options.reset) {
		resetResult = await deleteSeededRecords(db, recipient.id, seedEmails);
	}

	for (const seed of seedEmails) {
		const shouldInsert = await db.transaction(async (tx) => {
			const existing = await tx.query.messageTable.findFirst({
				columns: { id: true },
				where: (t, { and, eq }) =>
					and(eq(t.ownerId, recipient.id), eq(t.messageId, seed.messageId)),
			});
			if (existing) return false;

			const contact = await findOrCreateContact(tx, {
				ownerId: recipient.id,
				fromAddress: seed.fromAddress,
				fromName: seed.fromName,
				targetMailboxId: screenerMailbox.id,
			});
			const targetMailbox =
				mailboxById.get(contact.targetMailboxId) ?? mailboxById.get(screenerMailbox.id);
			if (!targetMailbox) throw new Error("Missing target mailbox for contact.");

			const unseen = targetMailbox.type === "important" || targetMailbox.type === "screener";
			const thread = await findOrCreateThread(tx, {
				recipientId: recipient.id,
				fromAddress: seed.fromAddress,
				targetMailboxId: targetMailbox.id,
				unseen,
				messageId: seed.messageId,
				createdAt: seed.createdAt,
				snippet: seed.snippet,
				subject: seed.subject,
				references: seed.references,
				inReplyTo: seed.inReplyTo,
			});

			await tx.insert(schema.messageTable).values({
				id: ulid(),
				from: seed.fromAddress,
				ownerId: recipient.id,
				threadId: thread.id,
				mailboxId: targetMailbox.id,
				unseen,
				createdAt: seed.createdAt,
				subject: seed.subject ?? undefined,
				to: [recipientEmail],
				cc: seed.cc,
				bcc: seed.bcc,
				replyTo: seed.replyTo,
				inReplyTo: seed.inReplyTo ?? undefined,
				messageId: seed.messageId,
				references: seed.references ?? undefined,
				snippet: seed.snippet ?? undefined,
				bodyText: seed.bodyText,
				bodyHTML: seed.bodyHTML,
				sizeInBytes: seed.raw.byteLength,
			});

			return true;
		});

		if (shouldInsert) {
			inserted += 1;
		} else {
			skipped += 1;
		}
	}

	return {
		status: "ok",
		resetPerformed: Boolean(options.reset),
		recipientUsername,
		recipientEmail,
		counts: {
			filesProcessed: files.length,
			filesSkipped: skippedFiles,
			messagesInserted: inserted,
			messagesSkipped: skipped,
			threadsDeleted: resetResult?.threads,
			contactsDeleted: resetResult?.contacts,
			deletedMessages: resetResult?.messages,
		},
	};
}

async function findOrCreateContact(
	tx: TransactionInstance,
	{
		ownerId,
		fromAddress,
		fromName,
		targetMailboxId,
	}: {
		ownerId: string;
		fromAddress: string;
		fromName: string;
		targetMailboxId: string;
	}
) {
	const existing = await tx.query.contactTable.findFirst({
		where: (t, { and, eq }) => and(eq(t.ownerId, ownerId), eq(t.address, fromAddress)),
	});
	if (existing) return existing;

	const [contact] = await tx
		.insert(schema.contactTable)
		.values({
			id: ulid(),
			address: fromAddress,
			ownerId,
			targetMailboxId,
			name: fromName,
			avatarPlaceholder: generateImagePlaceholder(fromName),
		})
		.returning();

	return contact;
}

async function loadSeedEmails() {
	const files = Object.keys(rawEmailModules)
		.map((file) => file.split("/").pop() ?? file)
		.sort((a, b) => a.localeCompare(b));
	const seedEmails: SeedEmail[] = [];
	let skippedFiles = 0;

	for (const fileName of files) {
		const match = Object.entries(rawEmailModules).find(([path]) => path.endsWith(fileName));
		if (!match) continue;

		const [, rawText] = match;
		if (typeof rawText !== "string") continue;

		const raw = encoder.encode(rawText);
		const parsedEmail = await PostalMime.parse(raw);

		const fromAddress = parsedEmail.from?.address?.trim();
		if (!fromAddress) {
			skippedFiles += 1;
			continue;
		}

		const fromName = parsedEmail.from?.name?.trim() || fromAddress || "Unknown Sender";
		const createdAt = coerceDate(parsedEmail.date);
		const cidResolver = buildCidResolver(parsedEmail.attachments);
		const normalizedBody = normalizeAndSanitizeEmailBody(parsedEmail, {
			cidResolver,
			blockRemoteImagesByDefault: false,
			allowDataImages: Boolean(cidResolver),
		});
		const bodyHTML = normalizedBody.htmlDocument;
		const bodyText = normalizedBody.text || null;
		const snippet = makeSnippet(bodyText, bodyHTML);
		const messageId = normalizeMessageId(parsedEmail.messageId) ?? (await makeSeedMessageId(raw));

		seedEmails.push({
			fileName,
			raw,
			fromAddress,
			fromName,
			createdAt,
			bodyText,
			bodyHTML,
			snippet,
			subject: parsedEmail.subject ?? null,
			references: parsedEmail.references,
			inReplyTo: parsedEmail.inReplyTo,
			messageId,
			cc: parsedEmail.cc?.map((a) => a.address).filter(Boolean),
			bcc: parsedEmail.bcc?.map((a) => a.address).filter(Boolean),
			replyTo: parsedEmail.replyTo?.map((a) => a.address).filter(Boolean),
		});
	}

	return { seedEmails, skippedFiles, files };
}

async function deleteSeededRecords(
	db: ReturnType<typeof getDB>,
	ownerId: string,
	seedEmails: SeedEmail[]
) {
	const messageIds = unique(seedEmails.map((seed) => seed.messageId));
	const addresses = unique(seedEmails.map((seed) => seed.fromAddress));

	return db.transaction(async (tx) => {
		let messagesDeleted = 0;
		const affectedThreadIds = new Set<string>();
		const affectedAddresses = new Set<string>();
		if (messageIds.length) {
			const existingMessages = await tx
				.select({
					id: schema.messageTable.id,
					threadId: schema.messageTable.threadId,
					from: schema.messageTable.from,
				})
				.from(schema.messageTable)
				.where(
					and(
						eq(schema.messageTable.ownerId, ownerId),
						inArray(schema.messageTable.messageId, messageIds)
					)
				);
			messagesDeleted = existingMessages.length;
			for (const row of existingMessages) {
				affectedThreadIds.add(row.threadId);
				affectedAddresses.add(row.from);
			}
			await tx
				.delete(schema.messageTable)
				.where(
					and(
						eq(schema.messageTable.ownerId, ownerId),
						inArray(schema.messageTable.messageId, messageIds)
					)
				);
		}

		let threadsToDelete: string[] = [];
		if (affectedThreadIds.size) {
			const remainingThreadRows = await tx
				.select({ id: schema.messageTable.threadId })
				.from(schema.messageTable)
				.where(eq(schema.messageTable.ownerId, ownerId));
			const remainingThreads = new Set(remainingThreadRows.map((row) => row.id));

			threadsToDelete = Array.from(affectedThreadIds).filter(
				(threadId) => !remainingThreads.has(threadId)
			);

			if (threadsToDelete.length) {
				await tx.delete(schema.threadTable).where(inArray(schema.threadTable.id, threadsToDelete));
			}
		}

		let contactsDeleted = 0;
		const candidateAddresses =
			affectedAddresses.size > 0 ? Array.from(affectedAddresses) : addresses;
		if (candidateAddresses.length) {
			const remainingAddressRows = await tx
				.select({ from: schema.messageTable.from })
				.from(schema.messageTable)
				.where(
					and(
						eq(schema.messageTable.ownerId, ownerId),
						inArray(schema.messageTable.from, candidateAddresses)
					)
				);
			const remainingAddresses = new Set(remainingAddressRows.map((row) => row.from));

			const contactsToDelete = candidateAddresses.filter(
				(address) => !remainingAddresses.has(address)
			);
			if (contactsToDelete.length) {
				const existingContacts = await tx
					.select({ id: schema.contactTable.id })
					.from(schema.contactTable)
					.where(
						and(
							eq(schema.contactTable.ownerId, ownerId),
							inArray(schema.contactTable.address, contactsToDelete)
						)
					);
				contactsDeleted = existingContacts.length;
				await tx
					.delete(schema.contactTable)
					.where(
						and(
							eq(schema.contactTable.ownerId, ownerId),
							inArray(schema.contactTable.address, contactsToDelete)
						)
					);
			}
		}

		return {
			messages: messagesDeleted,
			threads: threadsToDelete.length,
			contacts: contactsDeleted,
		};
	});
}

async function findOrCreateThread(
	tx: TransactionInstance,
	{
		recipientId,
		fromAddress,
		targetMailboxId,
		unseen,
		messageId,
		createdAt,
		snippet,
		subject,
		references,
		inReplyTo,
	}: {
		recipientId: string;
		fromAddress: string;
		targetMailboxId: string;
		unseen: boolean;
		messageId: string;
		createdAt: Date;
		snippet: string | null;
		subject: string | null;
		references?: string | null;
		inReplyTo?: string | null;
	}
) {
	const replyThread = await getThreadFromMessageId(tx, recipientId, inReplyTo);
	if (replyThread) return incrementThreadUnseenCount(tx, replyThread, unseen, createdAt);

	const referenceIds = parseReferences(references);
	for (const referenceId of referenceIds) {
		const referenceThread = await getThreadFromMessageId(tx, recipientId, referenceId);
		if (referenceThread) return incrementThreadUnseenCount(tx, referenceThread, unseen, createdAt);
	}

	const [createdThread] = await tx
		.insert(schema.threadTable)
		.values({
			id: ulid(),
			firstMessageFrom: fromAddress,
			mailboxId: targetMailboxId,
			ownerId: recipientId,
			title: subject ?? snippet,
			firstMessageSubject: subject ?? undefined,
			firstMessageId: messageId,
			snippet: snippet ?? undefined,
			unseenCount: unseen ? 1 : 0,
			lastMessageAt: createdAt,
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
	thread: typeof schema.threadTable.$inferSelect,
	unseen: boolean,
	lastMessageAt: Date
) {
	await tx
		.update(schema.threadTable)
		.set({
			...(unseen ? { unseenCount: increment(schema.threadTable.unseenCount) } : {}),
			lastMessageAt,
		})
		.where(eq(schema.threadTable.id, thread.id));

	return {
		...thread,
		unseenCount: unseen ? thread.unseenCount + 1 : thread.unseenCount,
		lastMessageAt,
	};
}

function makeSnippet(bodyText: string | null, bodyHTML?: string | null) {
	const text = bodyText?.trim();
	if (text) return text.slice(0, 50);

	const stripped = bodyHTML ? stripHtml(bodyHTML) : "";
	return stripped ? stripped.slice(0, 50) : null;
}

function normalizeMessageId(value?: string | null) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

async function makeSeedMessageId(raw: Uint8Array) {
	const hashBuffer = await crypto.subtle.digest(
		"SHA-1",
		raw.byteOffset === 0 && raw.byteLength === raw.buffer.byteLength
			? (raw.buffer as ArrayBuffer)
			: (raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer)
	);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	return `<seed-${hash}@seed.gebna.net>`;
}

function unique<T>(items: T[]) {
	return Array.from(new Set(items));
}

function stripHtml(html: string) {
	return html
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function coerceDate(value: unknown) {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? new Date() : value;
	}
	if (typeof value === "string" || typeof value === "number") {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? new Date() : date;
	}
	return new Date();
}
