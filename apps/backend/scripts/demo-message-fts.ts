import { createClient } from "@libsql/client";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { searchMessages } from "../src/lib/db/search";
import * as schema from "../src/lib/db/schema";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
const dbFileName = path.join(process.cwd(), "tmp-message-fts.db");

const now = () => new Date();

const main = async () => {
	await rm(dbFileName, { force: true });

	const client = createClient({ url: `file:${dbFileName}` });
	const db = drizzle(client, { schema });

	await migrate(db, { migrationsFolder });

	const userId = randomUUID();
	const mailboxId = randomUUID();
	const threadId = randomUUID();
	const messageId = randomUUID();

	await db.insert(schema.userTable).values({
		id: userId,
		username: `user-${userId}`,
		passwordHash: "hash",
		name: "Demo User",
		avatarPlaceholder: "placeholder",
	});

	await db.insert(schema.mailboxTable).values({
		id: mailboxId,
		userId,
		name: "Important",
		type: "important",
	});

	await db.insert(schema.threadTable).values({
		id: threadId,
		firstMessageFrom: "sender@example.com",
		ownerId: userId,
		mailboxId,
		unseenCount: 1,
		title: "Initial title",
		lastMessageAt: now(),
		snippet: "Snippet",
	});

	await db.insert(schema.messageTable).values({
		id: messageId,
		from: "sender@example.com",
		ownerId: userId,
		threadId,
		mailboxId,
		unseen: true,
		createdAt: now(),
		subject: "Urgent launch update",
		bodyText: "The launch is scheduled for tomorrow morning.",
		sizeInBytes: 123,
	});

	const [{ count: insertedCount }] = await db.all<{ count: number }>(
		sql`SELECT COUNT(*) as count FROM message_fts WHERE messageId = ${messageId}`
	);
	console.log("FTS insert synced:", insertedCount === 1);

	await db
		.update(schema.messageTable)
		.set({ subject: "Updated urgent launch update" })
		.where(eq(schema.messageTable.id, messageId));

	const [{ subject: updatedSubject }] = await db.all<{ subject: string }>(
		sql`SELECT subject FROM message_fts WHERE messageId = ${messageId}`
	);
	console.log("FTS update synced:", updatedSubject === "Updated urgent launch update");

	const searchResults = await searchMessages(db, {
		ownerId: userId,
		query: "urgent",
		mailboxId,
		limit: 5,
		offset: 0,
	});
	console.log("Search returned:", searchResults);

	await db.delete(schema.messageTable).where(eq(schema.messageTable.id, messageId));
	const [{ count: deletedCount }] = await db.all<{ count: number }>(
		sql`SELECT COUNT(*) as count FROM message_fts WHERE messageId = ${messageId}`
	);
	console.log("FTS delete synced:", deletedCount === 0);

	await client.close();
	await rm(dbFileName, { force: true });
};

void main().catch((error) => {
	console.error(error);
	process.exit(1);
});
