import { generateImagePlaceholder, ulid } from "@gebna/utils";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

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
		await tx.delete(dbSchema.emailMessages);
		await tx.delete(dbSchema.emailThreadParticipants);
		await tx.delete(dbSchema.emailThreads);
		await tx.delete(dbSchema.emailAddressRefs);
		await tx.delete(dbSchema.emailAddresses);
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
		now: new Date(baseNow),
		secondsAgo: (seconds: number) => new Date(baseNow - seconds * 1000),
	};

	const aliceUser = {
		id: "seed-user-alice",
		name: "Alice Johnson",
		email: "alice@gebna.net",
		username: "alice",
		displayUsername: "alice",
		avatarPlaceholder: generateImagePlaceholder("Alice Johnson"),
		emailVerified: true,
		createdAt: ctx.now,
		updatedAt: ctx.now,
	};
	const bobUser = {
		id: "seed-user-bob",
		name: "Bob Rivers",
		email: "bob@gebna.net",
		username: "bob",
		displayUsername: "bob",
		avatarPlaceholder: generateImagePlaceholder("Bob Rivers"),
		emailVerified: true,
		createdAt: ctx.now,
		updatedAt: ctx.now,
	};
	const carolUser = {
		id: "seed-user-carol",
		name: "Carol Diaz",
		email: "carol@gebna.net",
		username: "carol",
		displayUsername: "carol",
		avatarPlaceholder: generateImagePlaceholder("Carol Diaz"),
		emailVerified: true,
		createdAt: ctx.now,
		updatedAt: ctx.now,
	};

	const users = [aliceUser, bobUser, carolUser];

	const accounts = [
		{
			id: ulid(),
			accountId: aliceUser.username,
			providerId: "credential",
			userId: aliceUser.id,
			password: passwordHash,
			updatedAt: ctx.now,
		},
		{
			id: ulid(),
			accountId: bobUser.username,
			providerId: "credential",
			userId: bobUser.id,
			password: passwordHash,
			updatedAt: ctx.now,
		},
		{
			id: ulid(),
			accountId: carolUser.username,
			providerId: "credential",
			userId: carolUser.id,
			password: passwordHash,
			updatedAt: ctx.now,
		},
	];

	const emailAddresses = [
		{
			address: aliceUser.email,
			name: aliceUser.name,
			inferredAvatar: null,
			avatarPlaceholder: aliceUser.avatarPlaceholder,
		},
		{
			address: bobUser.email,
			name: bobUser.name,
			inferredAvatar: null,
			avatarPlaceholder: bobUser.avatarPlaceholder,
		},
		{
			address: carolUser.email,
			name: carolUser.name,
			inferredAvatar: null,
			avatarPlaceholder: carolUser.avatarPlaceholder,
		},
	];

	const aliceSelfRefId = ulid();
	const aliceBobRefId = ulid();
	const aliceCarolRefId = ulid();

	const bobSelfRefId = ulid();
	const bobAliceRefId = ulid();
	const bobCarolRefId = ulid();

	const carolSelfRefId = ulid();
	const carolAliceRefId = ulid();
	const carolBobRefId = ulid();

	const emailAddressRefs = [
		{
			id: aliceSelfRefId,
			ownerId: aliceUser.id,
			address: aliceUser.email,
			givenName: aliceUser.name,
			givenAvatar: null,
			createdAt: ctx.now,
			updatedAt: ctx.now,
			isBlocked: false,
			isSpam: false,
		},
		{
			id: aliceBobRefId,
			ownerId: aliceUser.id,
			address: bobUser.email,
			givenName: "Bob",
			givenAvatar: null,
			createdAt: ctx.now,
			updatedAt: ctx.now,
			isBlocked: false,
			isSpam: false,
		},
		{
			id: aliceCarolRefId,
			ownerId: aliceUser.id,
			address: carolUser.email,
			givenName: "Carol",
			givenAvatar: null,
			createdAt: ctx.now,
			updatedAt: ctx.now,
			isBlocked: false,
			isSpam: false,
		},
		{
			id: bobSelfRefId,
			ownerId: bobUser.id,
			address: bobUser.email,
			givenName: bobUser.name,
			givenAvatar: null,
			createdAt: ctx.now,
			updatedAt: ctx.now,
			isBlocked: false,
			isSpam: false,
		},
		{
			id: bobAliceRefId,
			ownerId: bobUser.id,
			address: aliceUser.email,
			givenName: "Alice",
			givenAvatar: null,
			createdAt: ctx.now,
			updatedAt: ctx.now,
			isBlocked: false,
			isSpam: false,
		},
		{
			id: bobCarolRefId,
			ownerId: bobUser.id,
			address: carolUser.email,
			givenName: "Carol",
			givenAvatar: null,
			createdAt: ctx.now,
			updatedAt: ctx.now,
			isBlocked: false,
			isSpam: false,
		},
		{
			id: carolSelfRefId,
			ownerId: carolUser.id,
			address: carolUser.email,
			givenName: carolUser.name,
			givenAvatar: null,
			createdAt: ctx.now,
			updatedAt: ctx.now,
			isBlocked: false,
			isSpam: false,
		},
		{
			id: carolAliceRefId,
			ownerId: carolUser.id,
			address: aliceUser.email,
			givenName: "Alice",
			givenAvatar: null,
			createdAt: ctx.now,
			updatedAt: ctx.now,
			isBlocked: false,
			isSpam: false,
		},
		{
			id: carolBobRefId,
			ownerId: carolUser.id,
			address: bobUser.email,
			givenName: "Bob",
			givenAvatar: null,
			createdAt: ctx.now,
			updatedAt: ctx.now,
			isBlocked: false,
			isSpam: false,
		},
	];

	const aliceBobThreadId = "seed-thread-alice-bob";
	const bobAliceThreadId = "seed-thread-bob-alice";
	const bobTeamThreadId = "seed-thread-bob-team";
	const aliceTeamThreadId = "seed-thread-alice-team";
	const carolTeamThreadId = "seed-thread-carol-team";

	const emailThreads = [
		{
			id: aliceBobThreadId,
			ownerId: aliceUser.id,
			privateConvoKey: [aliceUser.email, bobUser.email].sort().join(":"),
			title: "Product launch prep",
			createdAt: ctx.secondsAgo(3600),
			updatedAt: ctx.now,
			lastMessageId: null,
			lastMessageAt: ctx.secondsAgo(120),
			uploadedAvatar: null,
			unseenCount: 1,
		},
		{
			id: bobAliceThreadId,
			ownerId: bobUser.id,
			privateConvoKey: [aliceUser.email, bobUser.email].sort().join(":"),
			title: "Product launch prep",
			createdAt: ctx.secondsAgo(3600),
			updatedAt: ctx.now,
			lastMessageId: null,
			lastMessageAt: ctx.secondsAgo(120),
			uploadedAvatar: null,
			unseenCount: 0,
		},
		{
			id: bobTeamThreadId,
			ownerId: bobUser.id,
			title: "Beta feedback thread",
			createdAt: ctx.secondsAgo(5400),
			updatedAt: ctx.now,
			lastMessageId: null,
			lastMessageAt: ctx.secondsAgo(300),
			uploadedAvatar: null,
			unseenCount: 2,
		},
		{
			id: aliceTeamThreadId,
			ownerId: aliceUser.id,
			title: "Beta feedback thread",
			createdAt: ctx.secondsAgo(5400),
			updatedAt: ctx.now,
			lastMessageId: null,
			lastMessageAt: ctx.secondsAgo(300),
			uploadedAvatar: null,
			unseenCount: 2,
		},
		{
			id: carolTeamThreadId,
			ownerId: carolUser.id,
			title: "Beta feedback thread",
			createdAt: ctx.secondsAgo(5400),
			updatedAt: ctx.now,
			lastMessageId: null,
			lastMessageAt: ctx.secondsAgo(300),
			uploadedAvatar: null,
			unseenCount: 1,
		},
	];

	const emailThreadParticipants = [
		{
			threadId: aliceBobThreadId,
			emailAddressRefId: aliceSelfRefId,
		},
		{
			threadId: aliceBobThreadId,
			emailAddressRefId: aliceBobRefId,
		},
		{
			threadId: bobAliceThreadId,
			emailAddressRefId: bobSelfRefId,
		},
		{
			threadId: bobAliceThreadId,
			emailAddressRefId: bobAliceRefId,
		},
		{
			threadId: bobTeamThreadId,
			emailAddressRefId: bobSelfRefId,
		},
		{
			threadId: bobTeamThreadId,
			emailAddressRefId: bobAliceRefId,
		},
		{
			threadId: bobTeamThreadId,
			emailAddressRefId: bobCarolRefId,
		},
		{
			threadId: aliceTeamThreadId,
			emailAddressRefId: aliceSelfRefId,
		},
		{
			threadId: aliceTeamThreadId,
			emailAddressRefId: aliceBobRefId,
		},
		{
			threadId: aliceTeamThreadId,
			emailAddressRefId: aliceCarolRefId,
		},
		{
			threadId: carolTeamThreadId,
			emailAddressRefId: carolSelfRefId,
		},
		{
			threadId: carolTeamThreadId,
			emailAddressRefId: carolAliceRefId,
		},
		{
			threadId: carolTeamThreadId,
			emailAddressRefId: carolBobRefId,
		},
	];

	const emailMessages = [
		{
			id: "seed-message-1",
			ownerId: aliceUser.id,
			threadId: aliceBobThreadId,
			canonicalMessageId: "<seed-message-1@gebna.net>",
			from: aliceUser.email,
			to: bobUser.email,
			bodyPlaintext: "Hey Bob, sharing the latest launch checklist.",
			bodyHTML:
				"<p>Hey Bob, sharing the latest launch checklist. Let me know what we are missing.</p>",
			createdAt: ctx.secondsAgo(3200),
			metadata: {
				to: [{ address: bobUser.email, name: bobUser.name }],
				cc: [],
				bcc: [],
				replyTo: [],
				inReplyTo: undefined,
			},
			sizeInBytes: 2048,
			unseen: false,
		},
		{
			id: "seed-message-2",
			ownerId: aliceUser.id,
			threadId: aliceBobThreadId,
			canonicalMessageId: "<seed-message-2@gebna.net>",
			from: bobUser.email,
			to: aliceUser.email,
			bodyPlaintext: "Looks solid! I’ll finalize the press brief and loop in Carol for QA.",
			bodyHTML: "<p>Looks solid! I’ll finalize the press brief and loop in Carol for QA.</p>",
			createdAt: ctx.secondsAgo(1800),
			metadata: {
				to: [{ address: aliceUser.email, name: aliceUser.name }],
				cc: [],
				bcc: [],
				replyTo: [{ address: bobUser.email, name: bobUser.name }],
				inReplyTo: "<seed-message-1@gebna.net>",
			},
			sizeInBytes: 1980,
			unseen: false,
		},
		{
			id: "seed-message-3",
			ownerId: aliceUser.id,
			threadId: aliceBobThreadId,
			canonicalMessageId: "<seed-message-3@gebna.net>",
			from: bobUser.email,
			to: aliceUser.email,
			bodyPlaintext: "Sharing the QA checklist—can you verify the onboarding flow by tomorrow?",
			bodyHTML: "<p>Sharing the QA checklist—can you verify the onboarding flow by tomorrow?</p>",
			createdAt: ctx.secondsAgo(300),
			metadata: {
				to: [{ address: aliceUser.email, name: aliceUser.name }],
				cc: [{ address: carolUser.email, name: carolUser.name }],
				bcc: [],
				replyTo: [{ address: bobUser.email, name: bobUser.name }],
				inReplyTo: "<seed-message-2@gebna.net>",
			},
			sizeInBytes: 2150,
			unseen: true,
		},
		{
			id: "seed-message-1-bob",
			ownerId: bobUser.id,
			threadId: bobAliceThreadId,
			canonicalMessageId: "<seed-message-1@gebna.net>",
			from: aliceUser.email,
			to: bobUser.email,
			bodyPlaintext: "Hey Bob, sharing the latest launch checklist.",
			bodyHTML:
				"<p>Hey Bob, sharing the latest launch checklist. Let me know what we are missing.</p>",
			createdAt: ctx.secondsAgo(3200),
			metadata: {
				to: [{ address: bobUser.email, name: bobUser.name }],
				cc: [],
				bcc: [],
				replyTo: [],
				inReplyTo: undefined,
			},
			sizeInBytes: 2048,
			unseen: false,
		},
		{
			id: "seed-message-2-bob",
			ownerId: bobUser.id,
			threadId: bobAliceThreadId,
			canonicalMessageId: "<seed-message-2@gebna.net>",
			from: bobUser.email,
			to: aliceUser.email,
			bodyPlaintext: "Looks solid! I’ll finalize the press brief and loop in Carol for QA.",
			bodyHTML: "<p>Looks solid! I’ll finalize the press brief and loop in Carol for QA.</p>",
			createdAt: ctx.secondsAgo(1800),
			metadata: {
				to: [{ address: aliceUser.email, name: aliceUser.name }],
				cc: [],
				bcc: [],
				replyTo: [{ address: bobUser.email, name: bobUser.name }],
				inReplyTo: "<seed-message-1@gebna.net>",
			},
			sizeInBytes: 1980,
			unseen: false,
		},
		{
			id: "seed-message-3-bob",
			ownerId: bobUser.id,
			threadId: bobAliceThreadId,
			canonicalMessageId: "<seed-message-3@gebna.net>",
			from: bobUser.email,
			to: aliceUser.email,
			bodyPlaintext: "Sharing the QA checklist—can you verify the onboarding flow by tomorrow?",
			bodyHTML: "<p>Sharing the QA checklist—can you verify the onboarding flow by tomorrow?</p>",
			createdAt: ctx.secondsAgo(300),
			metadata: {
				to: [{ address: aliceUser.email, name: aliceUser.name }],
				cc: [{ address: carolUser.email, name: carolUser.name }],
				bcc: [],
				replyTo: [{ address: bobUser.email, name: bobUser.name }],
				inReplyTo: "<seed-message-2@gebna.net>",
			},
			sizeInBytes: 2150,
			unseen: true,
		},
		{
			id: "seed-message-4",
			ownerId: bobUser.id,
			threadId: bobTeamThreadId,
			canonicalMessageId: "<seed-message-4@gebna.net>",
			from: aliceUser.email,
			to: bobUser.email,
			bodyPlaintext: "Here’s the latest beta feedback summary.",
			bodyHTML: "<p>Here’s the latest beta feedback summary. Thoughts?</p>",
			createdAt: ctx.secondsAgo(2200),
			metadata: {
				to: [{ address: bobUser.email, name: bobUser.name }],
				cc: [{ address: carolUser.email, name: carolUser.name }],
				bcc: [],
				replyTo: [{ address: aliceUser.email, name: aliceUser.name }],
			},
			sizeInBytes: 1750,
			unseen: true,
		},
		{
			id: "seed-message-5",
			ownerId: bobUser.id,
			threadId: bobTeamThreadId,
			canonicalMessageId: "<seed-message-5@gebna.net>",
			from: carolUser.email,
			to: bobUser.email,
			bodyPlaintext: "Logged two UI bugs in the QA sheet.",
			bodyHTML: "<p>Logged two UI bugs in the QA sheet. Screenshots attached.</p>",
			createdAt: ctx.secondsAgo(600),
			metadata: {
				to: [{ address: bobUser.email, name: bobUser.name }],
				cc: [{ address: aliceUser.email, name: aliceUser.name }],
				bcc: [],
				replyTo: [{ address: carolUser.email, name: carolUser.name }],
				inReplyTo: "<seed-message-4@gebna.net>",
			},
			sizeInBytes: 1890,
			unseen: true,
		},
		{
			id: "seed-message-4-alice",
			ownerId: aliceUser.id,
			threadId: aliceTeamThreadId,
			canonicalMessageId: "<seed-message-4@gebna.net>",
			from: aliceUser.email,
			to: bobUser.email,
			bodyPlaintext: "Here’s the latest beta feedback summary.",
			bodyHTML: "<p>Here’s the latest beta feedback summary. Thoughts?</p>",
			createdAt: ctx.secondsAgo(2200),
			metadata: {
				to: [{ address: bobUser.email, name: bobUser.name }],
				cc: [{ address: carolUser.email, name: carolUser.name }],
				bcc: [],
				replyTo: [{ address: aliceUser.email, name: aliceUser.name }],
			},
			sizeInBytes: 1750,
			unseen: true,
		},
		{
			id: "seed-message-5-alice",
			ownerId: aliceUser.id,
			threadId: aliceTeamThreadId,
			canonicalMessageId: "<seed-message-5@gebna.net>",
			from: carolUser.email,
			to: bobUser.email,
			bodyPlaintext: "Logged two UI bugs in the QA sheet.",
			bodyHTML: "<p>Logged two UI bugs in the QA sheet. Screenshots attached.</p>",
			createdAt: ctx.secondsAgo(600),
			metadata: {
				to: [{ address: bobUser.email, name: bobUser.name }],
				cc: [{ address: aliceUser.email, name: aliceUser.name }],
				bcc: [],
				replyTo: [{ address: carolUser.email, name: carolUser.name }],
				inReplyTo: "<seed-message-4@gebna.net>",
			},
			sizeInBytes: 1890,
			unseen: true,
		},
		{
			id: "seed-message-4-carol",
			ownerId: carolUser.id,
			threadId: carolTeamThreadId,
			canonicalMessageId: "<seed-message-4@gebna.net>",
			from: aliceUser.email,
			to: bobUser.email,
			bodyPlaintext: "Here’s the latest beta feedback summary.",
			bodyHTML: "<p>Here’s the latest beta feedback summary. Thoughts?</p>",
			createdAt: ctx.secondsAgo(2200),
			metadata: {
				to: [{ address: bobUser.email, name: bobUser.name }],
				cc: [{ address: carolUser.email, name: carolUser.name }],
				bcc: [],
				replyTo: [{ address: aliceUser.email, name: aliceUser.name }],
			},
			sizeInBytes: 1750,
			unseen: false,
		},
		{
			id: "seed-message-5-carol",
			ownerId: carolUser.id,
			threadId: carolTeamThreadId,
			canonicalMessageId: "<seed-message-5@gebna.net>",
			from: carolUser.email,
			to: bobUser.email,
			bodyPlaintext: "Logged two UI bugs in the QA sheet.",
			bodyHTML: "<p>Logged two UI bugs in the QA sheet. Screenshots attached.</p>",
			createdAt: ctx.secondsAgo(600),
			metadata: {
				to: [{ address: bobUser.email, name: bobUser.name }],
				cc: [{ address: aliceUser.email, name: aliceUser.name }],
				bcc: [],
				replyTo: [{ address: carolUser.email, name: carolUser.name }],
				inReplyTo: "<seed-message-4@gebna.net>",
			},
			sizeInBytes: 1890,
			unseen: true,
		},
	];

	const lastMessageByThread = emailMessages.reduce<Record<string, { id: string; createdAt: Date }>>(
		(acc, message) => {
			const current = acc[message.threadId];
			if (!current || current.createdAt < message.createdAt) {
				acc[message.threadId] = { id: message.id, createdAt: message.createdAt };
			}
			return acc;
		},
		{}
	);

	await db.transaction(async (tx) => {
		await tx.insert(dbSchema.users).values(users);
		await tx.insert(dbSchema.accounts).values(accounts);
		await tx.insert(dbSchema.emailAddresses).values(emailAddresses);
		await tx.insert(dbSchema.emailAddressRefs).values(emailAddressRefs);
		await tx.insert(dbSchema.emailThreads).values(emailThreads);
		await tx.insert(dbSchema.emailThreadParticipants).values(emailThreadParticipants);
		await tx.insert(dbSchema.emailMessages).values(emailMessages);

		await Promise.all(
			Object.entries(lastMessageByThread).map(([threadId, last]) =>
				tx
					.update(dbSchema.emailThreads)
					.set({
						lastMessageId: last.id,
						lastMessageAt: last.createdAt,
						updatedAt: ctx.now,
					})
					.where(eq(dbSchema.emailThreads.id, threadId))
			)
		);
	});
}

async function ensureEmptyOrFail(db: DBInstance, shouldReset: boolean) {
	if (shouldReset) return;

	const existingUsers = await db.select({ value: dbSchema.users.id }).from(dbSchema.users).limit(1);

	if (existingUsers.length > 0) {
		throw new Error(
			"Database already has data. Re-run with `pnpm --filter @gebna/db seed -- reset` to wipe and reseed."
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
