import { argon2id, setWASMModules } from "argon2-wasm-edge";
// @ts-expect-error - wasm imports are handled by the bundler for workers
import argon2WASM from "argon2-wasm-edge/wasm/argon2.wasm";
// @ts-expect-error - wasm imports are handled by the bundler for workers
import blake2bWASM from "argon2-wasm-edge/wasm/blake2b.wasm";
import { inArray } from "drizzle-orm";

import { getDB } from "$lib/db";
import {
	conversationParticipantTable,
	conversationTable,
	conversationViewerStateTable,
	identityTable,
	messageDeliveryTable,
	messageTable,
	userTable,
} from "$lib/db/schema";
import { generateImagePlaceholder } from "$lib/utils/users";

const DEFAULT_PARTICIPANT_ROLE: (typeof conversationParticipantTable.$inferInsert)["role"] =
	"MEMBER";
const DEFAULT_PARTICIPANT_STATE: (typeof conversationParticipantTable.$inferInsert)["state"] =
	"ACTIVE";

type SeedUser = {
	userId: string;
	username: string;
	password: string;
	name: string;
	identityId: string;
	email: string;
};

type SeedIdentity = {
	id: string;
	address: string;
	kind: (typeof identityTable.$inferInsert)["kind"];
};

type SeedMessage = {
	id: string;
	conversationId: string;
	senderIdentityId: string;
	bodyText: string;
	externalMessageId?: string;
	createdAt: Date;
	deliveries: {
		recipientIdentityId: string;
		status: (typeof messageDeliveryTable.$inferInsert)["status"];
		transport: (typeof messageDeliveryTable.$inferInsert)["transport"];
		latestStatusChangeAt?: Date;
		error?: string | null;
	}[];
};

type SeedConversation = {
	id: string;
	kind: (typeof conversationTable.$inferInsert)["kind"];
	title: string;
	dmKey: string | null;
	participantIdentityIds: string[];
	messages: SeedMessage[];
};

export type SeedDemoOptions = {
	reset?: boolean;
};

export type SeedDemoResult = {
	status: "created" | "exists" | "reset-and-created";
	resetPerformed: boolean;
	users: Array<{
		id: string;
		username: string;
		password: string;
		name: string;
		email: string;
	}>;
	counts: {
		conversations: number;
		messages: number;
		deliveries: number;
		participants: number;
		identities: number;
	};
};

const argonParams = {
	memorySize: 19456,
	iterations: 3,
	parallelism: 1,
	hashLength: 32,
	outputType: "encoded" as const,
};

const argonReady = setWASMModules({ argon2WASM, blake2bWASM });

export async function seedDemo(
	env: CloudflareBindings,
	options: SeedDemoOptions = {}
): Promise<SeedDemoResult> {
	const seedUsers: SeedUser[] = [
		{
			userId: "seed-user-demo",
			username: "demo",
			password: "DemoPassword!23",
			name: "Gebna Demo",
			identityId: "seed-identity-demo",
			email: "demo@gebna.net",
		},
		{
			userId: "seed-user-fatima",
			username: "fatima",
			password: "DemoPassword!23",
			name: "Fatima Ali",
			identityId: "seed-identity-fatima",
			email: "fatima@gebna.net",
		},
		{
			userId: "seed-user-omar",
			username: "omar",
			password: "DemoPassword!23",
			name: "Omar Reforge",
			identityId: "seed-identity-omar",
			email: "omar@gebna.net",
		},
	];

	const identities: SeedIdentity[] = [
		...seedUsers.map((user) => ({
			id: user.identityId,
			address: user.email,
			kind: "GEBNA_USER" as const,
		})),
		{ id: "seed-identity-ops", address: "ops@acme.test", kind: "EXTERNAL_EMAIL" },
		{ id: "seed-identity-press", address: "press@launch-weeklies.test", kind: "EXTERNAL_EMAIL" },
	];

	const now = new Date("2024-06-01T12:00:00Z");
	const hoursAgo = (hrs: number) => new Date(now.getTime() - hrs * 60 * 60 * 1000);

	const conversations: SeedConversation[] = [
		{
			id: "seed-conv-demo-fatima",
			kind: "PRIVATE",
			title: "Product onboarding",
			dmKey: ["seed-identity-demo", "seed-identity-fatima"].sort().join(":"),
			participantIdentityIds: ["seed-identity-demo", "seed-identity-fatima"],
			messages: [
				{
					id: "seed-msg-fatima-1",
					conversationId: "seed-conv-demo-fatima",
					senderIdentityId: "seed-identity-fatima",
					bodyText: "Can we ship the DM fallback this sprint?",
					externalMessageId: "<seed-msg-fatima-1@gebna.seed>",
					createdAt: hoursAgo(6),
					deliveries: [
						{
							recipientIdentityId: "seed-identity-demo",
							status: "DELIVERED",
							transport: "GEBNA_DM",
							latestStatusChangeAt: hoursAgo(5.5),
						},
					],
				},
				{
					id: "seed-msg-fatima-2",
					conversationId: "seed-conv-demo-fatima",
					senderIdentityId: "seed-identity-demo",
					bodyText: "Yes—rolling out to the beta group today.",
					externalMessageId: "<seed-msg-fatima-2@gebna.seed>",
					createdAt: hoursAgo(3),
					deliveries: [
						{
							recipientIdentityId: "seed-identity-fatima",
							status: "DELIVERED",
							transport: "GEBNA_DM",
							latestStatusChangeAt: hoursAgo(2.8),
						},
					],
				},
			],
		},
		{
			id: "seed-conv-demo-omar",
			kind: "PRIVATE",
			title: "Infra follow-ups",
			dmKey: ["seed-identity-demo", "seed-identity-omar"].sort().join(":"),
			participantIdentityIds: ["seed-identity-demo", "seed-identity-omar"],
			messages: [
				{
					id: "seed-msg-omar-1",
					conversationId: "seed-conv-demo-omar",
					senderIdentityId: "seed-identity-omar",
					bodyText: "Provider failover is set. Need a quick DM test.",
					externalMessageId: "<seed-msg-omar-1@gebna.seed>",
					createdAt: hoursAgo(8),
					deliveries: [
						{
							recipientIdentityId: "seed-identity-demo",
							status: "DELIVERED",
							transport: "GEBNA_DM",
							latestStatusChangeAt: hoursAgo(7.5),
						},
					],
				},
				{
					id: "seed-msg-omar-2",
					conversationId: "seed-conv-demo-omar",
					senderIdentityId: "seed-identity-demo",
					bodyText: "Confirmed—DM transport is working end-to-end.",
					externalMessageId: "<seed-msg-omar-2@gebna.seed>",
					createdAt: hoursAgo(4),
					deliveries: [
						{
							recipientIdentityId: "seed-identity-omar",
							status: "DELIVERED",
							transport: "GEBNA_DM",
							latestStatusChangeAt: hoursAgo(3.7),
						},
					],
				},
			],
		},
		{
			id: "seed-conv-launch",
			kind: "GROUP",
			title: "Launch updates",
			dmKey: null,
			participantIdentityIds: [
				"seed-identity-demo",
				"seed-identity-fatima",
				"seed-identity-omar",
				"seed-identity-ops",
				"seed-identity-press",
			],
			messages: [
				{
					id: "seed-msg-launch-1",
					conversationId: "seed-conv-launch",
					senderIdentityId: "seed-identity-demo",
					bodyText: "Release candidate is live. Need press copy approvals.",
					externalMessageId: "<seed-msg-launch-1@gebna.seed>",
					createdAt: hoursAgo(12),
					deliveries: [
						{
							recipientIdentityId: "seed-identity-fatima",
							status: "DELIVERED",
							transport: "GEBNA_DM",
							latestStatusChangeAt: hoursAgo(11.8),
						},
						{
							recipientIdentityId: "seed-identity-omar",
							status: "DELIVERED",
							transport: "GEBNA_DM",
							latestStatusChangeAt: hoursAgo(11.8),
						},
						{
							recipientIdentityId: "seed-identity-ops",
							status: "SENT",
							transport: "EMAIL",
							latestStatusChangeAt: hoursAgo(11.9),
						},
						{
							recipientIdentityId: "seed-identity-press",
							status: "QUEUED",
							transport: "EMAIL",
							latestStatusChangeAt: hoursAgo(12),
						},
					],
				},
				{
					id: "seed-msg-launch-2",
					conversationId: "seed-conv-launch",
					senderIdentityId: "seed-identity-ops",
					bodyText: "Copy looks good. Scheduling send for tomorrow.",
					externalMessageId: "<seed-msg-launch-2@gebna.seed>",
					createdAt: hoursAgo(2),
					deliveries: [
						{
							recipientIdentityId: "seed-identity-demo",
							status: "DELIVERED",
							transport: "EMAIL",
							latestStatusChangeAt: hoursAgo(1.5),
						},
						{
							recipientIdentityId: "seed-identity-fatima",
							status: "DELIVERED",
							transport: "EMAIL",
							latestStatusChangeAt: hoursAgo(1.5),
						},
						{
							recipientIdentityId: "seed-identity-omar",
							status: "DELIVERED",
							transport: "EMAIL",
							latestStatusChangeAt: hoursAgo(1.5),
						},
						{
							recipientIdentityId: "seed-identity-press",
							status: "QUEUED",
							transport: "EMAIL",
							latestStatusChangeAt: hoursAgo(2),
						},
					],
				},
			],
		},
	];

	const db = getDB(env);

	if (options.reset) {
		await resetSeedData(db, {
			usernames: seedUsers.map((u) => u.username),
			identityIds: identities.map((i) => i.id),
			conversationIds: conversations.map((c) => c.id),
		});
	}

	const existingUsers = await db.query.userTable.findMany({
		where: (t, { inArray }) =>
			inArray(
				t.username,
				seedUsers.map((u) => u.username)
			),
	});
	if (existingUsers.length === seedUsers.length) {
		return {
			status: options.reset ? "reset-and-created" : "exists",
			resetPerformed: Boolean(options.reset),
			users: seedUsers.map((u) => ({
				id: existingUsers.find((ex) => ex.username === u.username)?.id ?? u.userId,
				username: u.username,
				password: u.password,
				name: u.name,
				email: u.email,
			})),
			counts: { conversations: 0, messages: 0, deliveries: 0, participants: 0, identities: 0 },
		};
	}

	const passwordHashes: Record<string, string> = {};
	for (const user of seedUsers) {
		passwordHashes[user.userId] = await hashPassword(user.password);
	}

	let totalMessages = 0;
	let totalDeliveries = 0;
	let totalParticipants = 0;

	await db.transaction(async (tx) => {
		for (const user of seedUsers) {
			await tx.insert(userTable).values({
				id: user.userId,
				username: user.username,
				passwordHash: passwordHashes[user.userId],
				name: user.name,
				avatarPlaceholder: generateImagePlaceholder(user.name),
			});
		}

		await tx.insert(identityTable).values(
			identities.map((identity) => ({
				id: identity.id,
				address: identity.address,
				kind: identity.kind,
				avatarPlaceholder: generateImagePlaceholder(identity.address),
			}))
		);

		for (const conversation of conversations) {
			const latestMessageAt = conversation.messages.reduce(
				(latest, message) => (message.createdAt > latest ? message.createdAt : latest),
				now
			);

			await tx.insert(conversationTable).values({
				id: conversation.id,
				kind: conversation.kind,
				title: conversation.title,
				dmKey: conversation.dmKey,
				createdAt: now,
				updatedAt: latestMessageAt,
				lastMessageAt: latestMessageAt,
			});

			const participantRows = conversation.participantIdentityIds.map((identityId) => ({
				id: `${conversation.id}:${identityId}`,
				conversationId: conversation.id,
				identityId,
				role: DEFAULT_PARTICIPANT_ROLE,
				state: DEFAULT_PARTICIPANT_STATE,
				joinedAt: now,
				lastReadMessageId: null,
			}));
			totalParticipants += participantRows.length;
			await tx.insert(conversationParticipantTable).values(participantRows).onConflictDoNothing();

			for (const message of conversation.messages) {
				totalMessages += 1;
				await tx.insert(messageTable).values({
					id: message.id,
					conversationId: conversation.id,
					senderIdentityId: message.senderIdentityId,
					bodyText: message.bodyText,
					externalMessageId: message.externalMessageId ?? null,
					bodyHTML: null,
					createdAt: message.createdAt,
					emailMetadata: null,
				});

				if (message.deliveries.length) {
					totalDeliveries += message.deliveries.length;
					await tx.insert(messageDeliveryTable).values(
						message.deliveries.map((delivery) => ({
							id: `${message.id}:${delivery.recipientIdentityId}`,
							messageId: message.id,
							recipientIdentityId: delivery.recipientIdentityId,
							status: delivery.status,
							transport: delivery.transport,
							latestStatusChangeAt: delivery.latestStatusChangeAt ?? message.createdAt,
							error: delivery.error ?? null,
						}))
					);
				}
			}

			for (const user of seedUsers) {
				const userIdentityId = user.identityId;
				const unreadCountForViewer = conversation.messages.reduce((count, message) => {
					const deliveredToViewer = message.deliveries.some(
						(delivery) =>
							delivery.recipientIdentityId === userIdentityId &&
							delivery.status !== "READ" &&
							delivery.status !== "FAILED"
					);
					return deliveredToViewer ? count + 1 : count;
				}, 0);

				await tx.insert(conversationViewerStateTable).values({
					id: `cvs-${user.userId}:${conversation.id}`,
					ownerId: user.userId,
					conversationId: conversation.id,
					mailbox: "IMPORTANT",
					unreadCount: unreadCountForViewer,
				});
			}
		}
	});

	return {
		status: options.reset ? "reset-and-created" : "created",
		resetPerformed: Boolean(options.reset),
		users: seedUsers.map((u) => ({
			id: u.userId,
			username: u.username,
			password: u.password,
			name: u.name,
			email: u.email,
		})),
		counts: {
			conversations: conversations.length,
			messages: totalMessages,
			deliveries: totalDeliveries,
			participants: totalParticipants,
			identities: identities.length,
		},
	};
}

async function hashPassword(password: string) {
	await argonReady;
	const salt = new Uint8Array(16);
	crypto.getRandomValues(salt);

	return argon2id({
		...argonParams,
		password,
		salt,
	});
}

async function resetSeedData(
	db: ReturnType<typeof getDB>,
	{
		usernames,
		identityIds,
		conversationIds,
	}: { usernames: string[]; identityIds: string[]; conversationIds: string[] }
) {
	await db.transaction(async (tx) => {
		if (conversationIds.length) {
			await tx.delete(conversationTable).where(inArray(conversationTable.id, conversationIds));
		}

		if (conversationIds.length) {
			await tx
				.delete(conversationViewerStateTable)
				.where(inArray(conversationViewerStateTable.conversationId, conversationIds));
		}

		if (identityIds.length) {
			await tx.delete(identityTable).where(inArray(identityTable.id, identityIds));
		}

		if (usernames.length) {
			await tx.delete(userTable).where(inArray(userTable.username, usernames));
		}
	});
}
