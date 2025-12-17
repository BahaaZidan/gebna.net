import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import PostalMime from "postal-mime";
import { ulid } from "ulid";

import { TransactionInstance } from "../lib/db";
import * as schema from "../lib/db/schema";
import { increment } from "../lib/db/utils";
import { normalizeAndSanitizeEmailBody } from "../lib/utils/email-html-normalization";
import { generateImagePlaceholder } from "../lib/utils/users";

type ThreadSelectModel = typeof schema.threadTable.$inferSelect;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawEmailsDir = path.resolve(__dirname, "data/raw-emails");
const recipientEmail = "demo@gebna.net";
const recipientUsername = "demo";
const shouldReset = process.argv.includes("--reset") || process.env.SEED_RAW_RESET === "true";

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

async function main() {
	const tursoUrl = requireEnv("TURSO_DATABASE_URL");
	const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

	const client = createClient({ url: tursoUrl, authToken: tursoAuthToken });
	const db = drizzle(client, { schema });

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

	if (shouldReset) {
		const deleted = await deleteSeededRecords(db, recipient.id, seedEmails);
		console.log("Raw email reset complete.");
		console.log(`Messages deleted: ${deleted.messages}`);
		console.log(`Threads deleted: ${deleted.threads}`);
		console.log(`Contacts deleted: ${deleted.contacts}`);
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

	console.log("Raw email seed complete.");
	console.log(`Files processed: ${files.length}`);
	console.log(`Files skipped: ${skippedFiles}`);
	console.log(`Messages inserted: ${inserted}`);
	console.log(`Messages skipped: ${skipped}`);
}

function requireEnv(key: string) {
	const value = process.env[key];
	if (!value) throw new Error(`Missing required env var: ${key}`);
	return value;
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
	const files = (await readdir(rawEmailsDir))
		.filter((file) => file.toLowerCase().endsWith(".eml"))
		.sort((a, b) => a.localeCompare(b));
	const seedEmails: SeedEmail[] = [];
	let skippedFiles = 0;

	for (const fileName of files) {
		const filePath = path.join(rawEmailsDir, fileName);
		const raw = await readFile(filePath);
		const parsedEmail = await PostalMime.parse(raw);

		const fromAddress = parsedEmail.from?.address?.trim();
		if (!fromAddress) {
			console.warn(`Skipping "${fileName}" because it has no From address.`);
			skippedFiles += 1;
			continue;
		}

		const fromName = parsedEmail.from?.name?.trim() || fromAddress || "Unknown Sender";
		const createdAt = coerceDate(parsedEmail.date);
		const normalizedBody = normalizeAndSanitizeEmailBody(parsedEmail);
		const bodyHTML = normalizedBody.htmlDocument;
		const bodyText = normalizedBody.text || null;
		const snippet = makeSnippet(bodyText, bodyHTML);
		const messageId = normalizeMessageId(parsedEmail.messageId) ?? makeSeedMessageId(raw);

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
	db: ReturnType<typeof drizzle>,
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
): Promise<ThreadSelectModel> {
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
	thread: ThreadSelectModel,
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

function makeSeedMessageId(raw: Uint8Array) {
	const hash = createHash("sha1").update(raw).digest("hex");
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

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
