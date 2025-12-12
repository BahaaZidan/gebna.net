import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { argon2id, setWASMModules } from "argon2-wasm-edge";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { ulid } from "ulid";

import * as schema from "../lib/db/schema";
import { generateImagePlaceholder } from "../lib/utils/users";

type MailboxType = (typeof schema.mailboxTable.$inferInsert)["type"];
type MailboxInsert = typeof schema.mailboxTable.$inferInsert;

type SenderProfile = {
	key: string;
	address: string;
	name: string;
	mailbox: MailboxType;
	avatar?: string;
};

type MessageSeed = {
	bodyText?: string;
	bodyHTML?: string;
	subject?: string;
	unread?: boolean;
	createdAt: Date;
	to?: string[];
	cc?: string[];
	replyTo?: string[];
};

type ThreadSeed = {
	sender: SenderProfile;
	mailbox: MailboxType;
	subject: string;
	messages: MessageSeed[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argonParams = {
	memorySize: 19456,
	iterations: 3,
	parallelism: 1,
	hashLength: 32,
};
const defaultUsername = process.env.SEED_USERNAME ?? "demo";
const defaultPassword = process.env.SEED_PASSWORD ?? "DemoPassword!23";
const defaultName = process.env.SEED_NAME ?? "Gebna Demo";
const shouldReset = process.argv.includes("--reset") || process.env.SEED_RESET === "true";

if (!globalThis.crypto)
	(globalThis as typeof globalThis & { crypto: Crypto }).crypto = webcrypto as Crypto;

async function main() {
	const tursoUrl = requireEnv("TURSO_DATABASE_URL");
	const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

	const client = createClient({ url: tursoUrl, authToken: tursoAuthToken });
	const db = drizzle(client, { schema });

	if (shouldReset) {
		await db.delete(schema.userTable).where(eq(schema.userTable.username, defaultUsername));
	}

	const existing = await db.query.userTable.findFirst({
		where: (t, { eq }) => eq(t.username, defaultUsername),
	});
	if (existing) {
		console.log(
			`User "${defaultUsername}" already exists. Pass --reset or SEED_RESET=true to recreate the demo data.`
		);
		return;
	}

	const userId = ulid();
	const mailboxes = makeMailboxes(userId);
	const mailboxByType = Object.fromEntries(mailboxes.map((mb) => [mb.type, mb])) as Record<
		MailboxType,
		MailboxInsert
	>;
	const userEmail = `${defaultUsername}@gebna.net`;

	const senderProfiles = makeSenders(mailboxByType);
	const threads = makeThreads(senderProfiles, mailboxByType, userId, userEmail);

	const passwordHash = await hashPassword(defaultPassword);
	const userAvatarPlaceholder = generateImagePlaceholder(defaultName);

	await db.transaction(async (tx) => {
		await tx.insert(schema.userTable).values({
			id: userId,
			username: defaultUsername,
			passwordHash,
			name: defaultName,
			avatarPlaceholder: userAvatarPlaceholder,
		});

		await tx.insert(schema.mailboxTable).values(mailboxes);
		await tx.insert(schema.address_userTable).values(senderProfiles);
		await tx.insert(schema.threadTable).values(threads.threads);
		await tx.insert(schema.messageTable).values(threads.messages);
	});

	console.log("Seed complete");
	console.log(`User: ${defaultUsername}`);
	console.log(`Password: ${defaultPassword}`);
	console.log(`Threads created: ${threads.threads.length}`);
	console.log(`Messages created: ${threads.messages.length}`);
}

function requireEnv(key: string) {
	const value = process.env[key];
	if (!value) throw new Error(`Missing required env var: ${key}`);
	return value;
}

let argonReady: Promise<void> | null = null;
async function ensureArgonReady() {
	if (!argonReady) {
		argonReady = (async () => {
			const [argonBytes, blakeBytes] = await Promise.all([
				readFile(path.resolve(__dirname, "../../node_modules/argon2-wasm-edge/wasm/argon2.wasm")),
				readFile(path.resolve(__dirname, "../../node_modules/argon2-wasm-edge/wasm/blake2b.wasm")),
			]);
			await setWASMModules({
				argon2WASM: await WebAssembly.compile(argonBytes),
				blake2bWASM: await WebAssembly.compile(blakeBytes),
			});
		})();
	}
	return argonReady;
}

async function hashPassword(password: string) {
	await ensureArgonReady();
	const salt = new Uint8Array(16);
	webcrypto.getRandomValues(salt);

	return argon2id({
		...argonParams,
		password,
		salt,
		outputType: "encoded",
	});
}

function makeMailboxes(userId: string): MailboxInsert[] {
	return [
		{ id: ulid(), userId, type: "screener", name: "Screener" },
		{ id: ulid(), userId, type: "important", name: "Important" },
		{ id: ulid(), userId, type: "news", name: "News" },
		{ id: ulid(), userId, type: "transactional", name: "Transactional" },
		{ id: ulid(), userId, type: "trash", name: "Trash" },
	];
}

function makeSenders(
	mailboxes: Record<MailboxType, MailboxInsert>
): (typeof schema.address_userTable.$inferInsert)[] {
	const senders: SenderProfile[] = [
		{
			key: "maya",
			address: "maya.patel@acme-analytics.test",
			name: "Maya Patel",
			mailbox: "important",
			avatar: "https://unavatar.io/github/mayapatel",
		},
		{
			key: "zoe",
			address: "zoe@studioevergreen.test",
			name: "Zoe Keller",
			mailbox: "important",
			avatar: "https://unavatar.io/zoe",
		},
		{
			key: "omar",
			address: "omar@reforge.news",
			name: "Omar Reforge",
			mailbox: "news",
			avatar: "https://unavatar.io/omar",
		},
		{
			key: "nina",
			address: "nina@launch-weeklies.test",
			name: "Nina Alvarez",
			mailbox: "news",
		},
		{
			key: "atlas",
			address: "alerts@atlasbank.test",
			name: "Atlas Bank",
			mailbox: "transactional",
		},
		{
			key: "relay",
			address: "no-reply@relay-payments.test",
			name: "Relay Payments",
			mailbox: "transactional",
		},
		{
			key: "rashid",
			address: "rashid@futura-labs.test",
			name: "Rashid Noor",
			mailbox: "screener",
		},
		{
			key: "claire",
			address: "claire@northwind-ventures.test",
			name: "Claire Johnson",
			mailbox: "screener",
			avatar: "https://unavatar.io/linkedin/clairejohnson",
		},
	];

	return senders.map((sender) => ({
		id: ulid(),
		address: sender.address,
		userId: mailboxes[sender.mailbox].userId,
		targetMailboxId: mailboxes[sender.mailbox].id,
		name: sender.name,
		avatar: sender.avatar,
		avatarPlaceholder: generateImagePlaceholder(sender.name),
	}));
}

function makeThreads(
	senders: (typeof schema.address_userTable.$inferInsert)[],
	mailboxes: Record<MailboxType, MailboxInsert>,
	userId: string,
	userEmail: string
) {
	const senderMap = new Map(senders.map((s) => [s.address, s]));
	const now = Date.now();
	const hoursAgo = (hours: number) => new Date(now - hours * 60 * 60 * 1000);
	const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000);

	const seeds: ThreadSeed[] = [
		{
			sender: {
				key: "maya",
				address: "maya.patel@acme-analytics.test",
				name: "Maya Patel",
				mailbox: "important",
			},
			mailbox: "important",
			subject: "Deliverability audit notes + next steps",
			messages: [
				{
					bodyText:
						"Sharing the top-line findings from your inbox warmup. CTRs are solid, but SPF is still missing for the new domain. I sketched next steps in the doc below.",
					createdAt: hoursAgo(12),
					unread: false,
					to: [userEmail],
				},
				{
					bodyText:
						"I can meet tomorrow to finalize the rollout. If you want, I can join your onboarding call with the SDR team.",
					createdAt: hoursAgo(3),
					unread: true,
					to: [userEmail],
					cc: ["ops@acme-analytics.test"],
				},
			],
		},
		{
			sender: {
				key: "zoe",
				address: "zoe@studioevergreen.test",
				name: "Zoe Keller",
				mailbox: "important",
			},
			mailbox: "important",
			subject: "Prototype feedback and story beats",
			messages: [
				{
					bodyHTML:
						"<p>Love the calmer motion in the latest build. The onboarding story is almost there — I left inline comments with copy tweaks and a short Loom.</p><p>Let me know what you keep vs. cut.</p>",
					createdAt: hoursAgo(26),
					unread: false,
					to: [userEmail],
				},
				{
					bodyText:
						"Quick nudge: should we swap the hero for a live inbox preview? I can send a stitched mock if helpful.",
					createdAt: hoursAgo(2),
					unread: true,
					to: [userEmail],
				},
			],
		},
		{
			sender: { key: "omar", address: "omar@reforge.news", name: "Omar Reforge", mailbox: "news" },
			mailbox: "news",
			subject: "Refactor Friday — staying out of spam folders",
			messages: [
				{
					bodyText:
						"This week we broke down how teams keep cold starts out of spam without killing velocity. Favorite bit: the gating flow used by Cabin's crew. Read time ~4 min.",
					createdAt: daysAgo(1),
					unread: true,
					to: [userEmail],
				},
			],
		},
		{
			sender: {
				key: "nina",
				address: "nina@launch-weeklies.test",
				name: "Nina Alvarez",
				mailbox: "news",
			},
			mailbox: "news",
			subject: "Launch Weeklies — founders screening their inbox",
			messages: [
				{
					bodyText:
						"Featuring a short story on how scrappy teams vet inbound before responding. We quoted Gebna briefly — let me know if anything looks off.",
					createdAt: daysAgo(5),
					unread: false,
					to: [userEmail],
				},
			],
		},
		{
			sender: {
				key: "atlas",
				address: "alerts@atlasbank.test",
				name: "Atlas Bank",
				mailbox: "transactional",
			},
			mailbox: "transactional",
			subject: "Payment confirmation — Gebna subscription",
			messages: [
				{
					bodyText:
						"We received your payment for the Gebna subscription (Invoice #21983). No action needed. Download the receipt from your billing portal anytime.",
					createdAt: daysAgo(2),
					unread: false,
					to: [userEmail],
				},
			],
		},
		{
			sender: {
				key: "relay",
				address: "no-reply@relay-payments.test",
				name: "Relay Payments",
				mailbox: "transactional",
			},
			mailbox: "transactional",
			subject: "Reminder: verify new payout destination",
			messages: [
				{
					bodyText:
						"A new payout destination was added for your workspace. Verify it within 24 hours to avoid delays.",
					createdAt: hoursAgo(8),
					unread: true,
					to: [userEmail],
				},
			],
		},
		{
			sender: {
				key: "rashid",
				address: "rashid@futura-labs.test",
				name: "Rashid Noor",
				mailbox: "screener",
			},
			mailbox: "screener",
			subject: "YC alum here — quick collab?",
			messages: [
				{
					bodyText:
						"Hey Bahaa, I run product at Futura Labs. Saw your post on inbox filtering — can I steal 15 minutes to swap notes on routing first-touch emails?",
					createdAt: hoursAgo(6),
					unread: true,
					to: [userEmail],
				},
			],
		},
		{
			sender: {
				key: "claire",
				address: "claire@northwind-ventures.test",
				name: "Claire Johnson",
				mailbox: "screener",
			},
			mailbox: "screener",
			subject: "Potential partnership with our portfolio",
			messages: [
				{
					bodyText:
						"We have 4 founders battling noisy inboxes. Happy to intro if you're taking on pilots this quarter.",
					createdAt: hoursAgo(5),
					unread: true,
					to: [userEmail],
				},
			],
		},
	];

	const threads: (typeof schema.threadTable.$inferInsert)[] = [];
	const messages: (typeof schema.messageTable.$inferInsert)[] = [];

	for (const seed of seeds) {
		const sender = senderMap.get(seed.sender.address);
		const mailbox = mailboxes[seed.mailbox];
		if (!sender) throw new Error(`Missing sender profile for ${seed.sender.address}`);
		if (!mailbox) throw new Error(`Missing mailbox for type ${seed.mailbox}`);

		const threadId = ulid();
		const messageRows: (typeof schema.messageTable.$inferInsert)[] = [];

		for (const [index, message] of seed.messages.entries()) {
			const messageId = `<${ulid().toLowerCase()}@seed.gebna.net>`;
			const previous = messageRows[messageRows.length - 1];

			messageRows.push({
				id: ulid(),
				from: sender.address,
				recipientId: userId,
				threadId,
				mailboxId: mailbox.id,
				unread: message.unread !== false,
				createdAt: message.createdAt,
				subject: message.subject ?? seed.subject,
				to: message.to ?? [userEmail],
				cc: message.cc,
				replyTo: message.replyTo,
				inReplyTo: index === 0 ? undefined : (previous?.messageId ?? undefined),
				messageId,
				references: previous?.messageId ? previous.messageId : undefined,
				snippet:
					message.bodyText?.slice(0, 120) ??
					message.bodyHTML?.replace(/<[^>]+>/g, "")?.slice(0, 120),
				bodyText: message.bodyText,
				bodyHTML: message.bodyHTML,
				sizeInBytes: estimateSize(message, seed.subject),
			});
		}

		const unreadCount = messageRows.filter((m) => m.unread).length;
		const firstMessage = messageRows[0];
		const lastMessage = messageRows[messageRows.length - 1];

		threads.push({
			id: threadId,
			from: sender.address,
			recipientId: userId,
			mailboxId: mailbox.id,
			unreadCount,
			title: seed.subject,
			snippet: firstMessage?.snippet,
			lastMessageAt: lastMessage?.createdAt ?? new Date(),
			firstMessageId: firstMessage?.messageId,
			firstMessageSubject: firstMessage?.subject,
		});

		messages.push(...messageRows);
	}

	return { threads, messages };
}

function estimateSize(message: MessageSeed, subject: string) {
	const body = message.bodyText ?? message.bodyHTML ?? "";
	return Math.max(700, Buffer.byteLength(subject + body, "utf8") + 400);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
