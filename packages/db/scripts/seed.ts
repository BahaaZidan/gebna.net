import { eq } from "drizzle-orm";

import { generateImagePlaceholder, ulid } from "@gebna/utils";
import { hashPassword } from "better-auth/crypto";

import { dbSchema, getDB, type DBInstance } from "../src/index.js";

declare const process: {
	env: Record<string, string | undefined>;
	argv: string[];
	exit: (code?: number) => never;
};

function parseArgs() {
	const args = process.argv.slice(2).filter((arg: string) => arg !== "--" && arg !== "-");
	const shouldReset = args.includes("reset") || args.includes("--reset") || args.includes("-r");

	return { shouldReset };
}

async function resetDatabase(db: DBInstance) {
	console.log("⚠️  Resetting database (deleting all rows)...");

	await db.transaction(async (tx) => {
		await tx.delete(dbSchema.messageDeliveries);
		await tx.delete(dbSchema.messages);
		await tx.delete(dbSchema.conversationViewerStates);
		await tx.delete(dbSchema.conversationParticipants);
		await tx.delete(dbSchema.conversations);
		await tx.delete(dbSchema.identityRelationships);
		await tx.delete(dbSchema.identities);
		await tx.delete(dbSchema.sessions);
		await tx.delete(dbSchema.accounts);
		await tx.delete(dbSchema.verifications);
		await tx.delete(dbSchema.users);
	});
}

type SeedContext = {
	now: Date;
	secondsAgo: (seconds: number) => Date;
};

async function seedDatabase(db: DBInstance) {
	const baseNow = Date.now();
	const passwordHash = await hashPassword("password");
	const ctx: SeedContext = {
		now: new Date(),
		secondsAgo: (seconds: number) => new Date(baseNow - seconds * 1000),
	};

	const aliceUserId = "seed-user-alice";
	const bobUserId = "seed-user-bob";
	const carolUserId = "seed-user-carol";

	const aliceIdentityId = "seed-identity-alice";
	const bobIdentityId = "seed-identity-bob";
	const carolIdentityId = "seed-identity-carol";

	const conversationId = "seed-conversation-alice-bob";
	const dmKey = [aliceIdentityId, bobIdentityId].sort().join(":");

	const messageOneId = "seed-message-1";
	const messageTwoId = "seed-message-2";
	const messageThreeId = "seed-message-3";
	const aliceParticipantId = ulid();
	const bobParticipantId = ulid();

	const aliceUser = {
		id: aliceUserId,
		name: "Alice Johnson",
		email: "alice@example.com",
		username: "alice",
		displayUsername: "alice",
		avatarPlaceholder: generateImagePlaceholder("Alice Johnson"),
		emailVerified: true,
		createdAt: ctx.now,
		updatedAt: ctx.now,
	};
	const bobUser = {
		id: bobUserId,
		name: "Bob Rivers",
		email: "bob@example.com",
		username: "bob",
		displayUsername: "bob",
		avatarPlaceholder: generateImagePlaceholder("Bob Rivers"),
		emailVerified: true,
		createdAt: ctx.now,
		updatedAt: ctx.now,
	};
	const carolUser = {
		id: carolUserId,
		name: "Carol Diaz",
		email: "carol@example.com",
		username: "carol",
		displayUsername: "carol",
		avatarPlaceholder: generateImagePlaceholder("Carol Diaz"),
		emailVerified: true,
		createdAt: ctx.now,
		updatedAt: ctx.now,
	};

	const users = [aliceUser, bobUser, carolUser];

	const identities = [
		{
			id: aliceIdentityId,
			ownerId: aliceUserId,
			kind: "INTERNAL" as const,
			address: aliceUser.email,
			name: aliceUser.name,
			avatarPlaceholder: aliceUser.avatarPlaceholder,
			createdAt: ctx.now,
			updatedAt: ctx.now,
		},
		{
			id: bobIdentityId,
			ownerId: bobUserId,
			kind: "INTERNAL" as const,
			address: bobUser.email,
			name: bobUser.name,
			avatarPlaceholder: bobUser.avatarPlaceholder,
			createdAt: ctx.now,
			updatedAt: ctx.now,
		},
		{
			id: carolIdentityId,
			ownerId: carolUserId,
			kind: "INTERNAL" as const,
			address: carolUser.email,
			name: carolUser.name,
			avatarPlaceholder: carolUser.avatarPlaceholder,
			createdAt: ctx.now,
			updatedAt: ctx.now,
		},
	];

	const accounts = [
		{
			id: ulid(),
			accountId: aliceUser.username,
			providerId: "credential",
			userId: aliceUserId,
			// Stored with Better Auth's scrypt-based hashing to match the username sign-in flow.
			password: passwordHash,
		},
		{
			id: ulid(),
			accountId: bobUser.username,
			providerId: "credential",
			userId: bobUserId,
			password: passwordHash,
		},
		{
			id: ulid(),
			accountId: carolUser.username,
			providerId: "credential",
			userId: carolUserId,
			password: passwordHash,
		},
	];

	const identityRelationships = [
		{
			id: ulid(),
			ownerId: aliceUserId,
			identityId: bobIdentityId,
			isContact: true,
			givenName: "Bob",
			createdAt: ctx.now,
			updatedAt: ctx.now,
		},
		{
			id: ulid(),
			ownerId: aliceUserId,
			identityId: carolIdentityId,
			isContact: true,
			givenName: "Carol",
			createdAt: ctx.now,
			updatedAt: ctx.now,
		},
		{
			id: ulid(),
			ownerId: bobUserId,
			identityId: aliceIdentityId,
			isContact: true,
			givenName: "Alice",
			createdAt: ctx.now,
			updatedAt: ctx.now,
		},
	];

	const participants = [
		{
			id: aliceParticipantId,
			conversationId,
			identityId: aliceIdentityId,
			ownerId: aliceUserId,
			role: "ADMIN" as const,
			state: "ACTIVE" as const,
			joinedAt: ctx.secondsAgo(1800),
			lastSeenMessageId: null,
		},
		{
			id: bobParticipantId,
			conversationId,
			identityId: bobIdentityId,
			ownerId: bobUserId,
			role: "MEMBER" as const,
			state: "ACTIVE" as const,
			joinedAt: ctx.secondsAgo(1750),
			lastSeenMessageId: null,
		},
	];

	const messageOne = {
		id: messageOneId,
		conversationId,
		senderIdentityId: aliceIdentityId,
		bodyPlainText: "Hey Bob, sharing the latest launch checklist. Let me know what we’re missing.",
		bodyPlainTextSnippet: "Hey Bob, sharing the latest launch checklist...",
		createdAt: ctx.secondsAgo(1200),
		updatedAt: ctx.secondsAgo(1200),
	};
	const messageTwo = {
		id: messageTwoId,
		conversationId,
		senderIdentityId: bobIdentityId,
		bodyPlainText: "Looks solid! I’ll finalize the press brief and loop in Carol for QA.",
		bodyPlainTextSnippet: "Looks solid! I’ll finalize the press brief and loop in Carol for QA.",
		createdAt: ctx.secondsAgo(900),
		updatedAt: ctx.secondsAgo(900),
	};
	const messageThree = {
		id: messageThreeId,
		conversationId,
		senderIdentityId: aliceIdentityId,
		bodyPlainText: "Perfect. Carol, can you verify the onboarding flow by tomorrow?",
		bodyPlainTextSnippet: "Perfect. Carol, can you verify the onboarding flow by tomorrow?",
		createdAt: ctx.secondsAgo(400),
		updatedAt: ctx.secondsAgo(400),
	};

	const messages = [messageOne, messageTwo, messageThree];

	const conversation = {
		id: conversationId,
		kind: "PRIVATE" as const,
		title: "Product launch prep",
		dmKey,
		lastMessageAt: messageThree.createdAt,
		createdAt: ctx.secondsAgo(1800),
		updatedAt: ctx.now,
	};

	const viewerStates = [
		{
			id: ulid(),
			ownerId: aliceUserId,
			conversationId,
			mailbox: "IMPORTANT" as const,
			unseenCount: 0,
			createdAt: ctx.secondsAgo(1700),
			updatedAt: ctx.secondsAgo(200),
		},
		{
			id: ulid(),
			ownerId: bobUserId,
			conversationId,
			mailbox: "IMPORTANT" as const,
			unseenCount: 1,
			createdAt: ctx.secondsAgo(1700),
			updatedAt: ctx.secondsAgo(400),
		},
	];

	const deliveries = [
		{
			id: ulid(),
			messageId: messageOneId,
			recipientIdentityId: bobIdentityId,
			status: "DELIVERED" as const,
			transport: "DIRECT" as const,
			latestStatusChangeAt: ctx.secondsAgo(1100),
		},
		{
			id: ulid(),
			messageId: messageTwoId,
			recipientIdentityId: aliceIdentityId,
			status: "SEEN" as const,
			transport: "DIRECT" as const,
			latestStatusChangeAt: ctx.secondsAgo(850),
		},
		{
			id: ulid(),
			messageId: messageThreeId,
			recipientIdentityId: bobIdentityId,
			status: "QUEUED" as const,
			transport: "DIRECT" as const,
			latestStatusChangeAt: ctx.secondsAgo(390),
		},
	];

	await db.transaction(async (tx) => {
		await tx.insert(dbSchema.users).values(users);
		await tx.insert(dbSchema.accounts).values(accounts);
		await tx.insert(dbSchema.identities).values(identities);
		await tx.insert(dbSchema.identityRelationships).values(identityRelationships);

		await tx.insert(dbSchema.conversations).values(conversation);
		await tx.insert(dbSchema.messages).values(messages);
		await tx.insert(dbSchema.conversationParticipants).values(participants);
		await tx.insert(dbSchema.messageDeliveries).values(deliveries);
		await tx.insert(dbSchema.conversationViewerStates).values(viewerStates);

		await tx
			.update(dbSchema.conversations)
			.set({
				lastMessageId: messageThreeId,
				lastMessageAt: messageThree.createdAt,
				updatedAt: ctx.now,
			})
			.where(eq(dbSchema.conversations.id, conversationId));

		await tx
			.update(dbSchema.conversationParticipants)
			.set({ lastSeenMessageId: messageThreeId })
			.where(eq(dbSchema.conversationParticipants.id, aliceParticipantId));

		await tx
			.update(dbSchema.conversationParticipants)
			.set({ lastSeenMessageId: messageTwoId })
			.where(eq(dbSchema.conversationParticipants.id, bobParticipantId));
	});
}

async function ensureEmptyOrFail(db: DBInstance, shouldReset: boolean) {
	if (shouldReset) return;

	const existingUsers = await db.select({ value: dbSchema.users.id }).from(dbSchema.users).limit(1);

	if (existingUsers.length > 0) {
		throw new Error(
			"Database already has data. Re-run with `pnpm --filter @gebna/db seed -- - reset` to wipe and reseed."
		);
	}
}

async function main() {
	const { shouldReset } = parseArgs();

	if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
		throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN. Load env before running.");
	}

	const db = getDB({
		url: process.env.TURSO_DATABASE_URL!,
		authToken: process.env.TURSO_AUTH_TOKEN!,
	});

	if (shouldReset) {
		await resetDatabase(db);
	}

	await ensureEmptyOrFail(db, shouldReset);
	await seedDatabase(db);

	console.log("✅ Seeded @gebna/db successfully.");
}

main().catch((error) => {
	console.error("❌ Seeding failed:", error);
	process.exit(1);
});
