import { eq, inArray } from "drizzle-orm";
import PostalMime, { type Address } from "postal-mime";
import * as R from "ramda";
import { ulid } from "ulid";

import {
	ConversationInsertModel,
	ConversationParticipantInsertModel,
	ConversationSelectModel,
	getDB,
	MessageDeliveryInsertModel,
	MessageInsertModel,
} from "$lib/db";
import {
	conversationParticipantTable,
	conversationTable,
	conversationViewerStateTable,
	messageDeliveryTable,
	messageTable,
} from "$lib/db/schema";
import { InferAddressAvatarQueueMessage } from "$lib/queue/types";
import { buildCidResolver } from "$lib/utils/email-attachments";
import { normalizeAndSanitizeEmailBody } from "$lib/utils/email-html-normalization";
import {
	ensureIdentities,
	extractMessageIds,
	findConversationIdByEmailThreadMessageIds,
} from "$lib/utils/email-ingest";

type SeedEmail = {
	fileName: string;
	parsedEmail: Awaited<ReturnType<typeof PostalMime.parse>>;
	createdAt: Date;
	externalMessageId: string;
	bodyText: string | null;
	bodyHTML: string | null;
};

export type SeedRawEmailOptions = {
	reset?: boolean;
	recipientUsername?: string;
	recipientEmail?: string;
	limit?: number;
	offset?: number;
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
		totalFiles: number;
		conversationsDeleted?: number;
		messagesDeleted?: number;
		deliveriesDeleted?: number;
		participantsDeleted?: number;
		viewerStatesDeleted?: number;
	};
};

const DEFAULT_PARTICIPANT_ROLE: ConversationParticipantInsertModel["role"] = "MEMBER";
const DEFAULT_PARTICIPANT_STATE: ConversationParticipantInsertModel["state"] = "ACTIVE";

const rawEmailModules = import.meta.glob("./data/raw-emails/*.eml", {
	as: "raw",
	eager: true,
});

const rawEmailEntries = Object.entries(rawEmailModules).map(([path, raw]) => ({
	fileName: path.split("/").pop() ?? path,
	raw,
}));
const rawEmailByName = new Map(rawEmailEntries.map((entry) => [entry.fileName, entry.raw]));

const encoder = new TextEncoder();

export async function seedRawEmails(
	env: CloudflareBindings,
	options: SeedRawEmailOptions = {}
): Promise<SeedRawEmailResult> {
	const recipientUsername = options.recipientUsername ?? "demo";
	const recipientEmail = options.recipientEmail ?? `${recipientUsername}@gebna.net`;
	const limit = options.limit && options.limit > 0 ? options.limit : undefined;
	const offset = options.offset && options.offset > 0 ? options.offset : 0;

	const db = getDB(env);
	const recipient = await db.query.userTable.findFirst({
		where: (t, { eq }) => eq(t.username, recipientUsername),
	});
	if (!recipient) {
		throw new Error(`User "${recipientUsername}" not found. Seed the demo user first.`);
	}

	const resetSeedEmails = options.reset ? (await loadSeedEmails()).seedEmails : undefined;
	const { seedEmails, skippedFiles, totalFiles } = await loadSeedEmails({ limit, offset });

	let messagesInserted = 0;
	let messagesSkipped = 0;
	let resetCounts: Awaited<ReturnType<typeof deleteSeededRecords>> | undefined;

	if (options.reset) {
		resetCounts = await deleteSeededRecords(db, resetSeedEmails ?? seedEmails);
	}

	for (const seed of seedEmails) {
		const parsedEmail = seed.parsedEmail;
		const fromAddress = parsedEmail.from?.address;
		if (!fromAddress) {
			messagesSkipped += 1;
			continue;
		}

		const toEntries: Address[] = [
			{
				address: recipientEmail,
				name: recipient.name ?? "",
			},
		];
		const ccEntries = parsedEmail.cc?.filter((a) => !!a.address) ?? [];
		const bccEntries = parsedEmail.bcc?.filter((a) => !!a.address) ?? [];
		const replyToEntries = parsedEmail.replyTo?.filter((a) => !!a.address) ?? [];
		const to = toEntries.map((a) => a.address!);
		const cc = ccEntries.map((a) => a.address!);
		const bcc = bccEntries.map((a) => a.address!);
		const replyTo = replyToEntries.map((a) => a.address!);
		const participants = [
			parsedEmail.from,
			...toEntries,
			...ccEntries,
			...bccEntries,
			...replyToEntries,
			{ address: recipientEmail, name: "" },
		].filter((entry): entry is Address => Boolean(entry?.address));
		const uniqueParticipants = R.uniqBy((p) => p.address, participants);

		const participantIdentities = await ensureIdentities(db, uniqueParticipants);
		const senderIdentity =
			participantIdentities.find(
				(i) => i.address.toLowerCase() === fromAddress.toLowerCase()
			) ?? null;
		if (!senderIdentity) throw new Error("Missing sender identity");

		const desiredConversationKind: ConversationInsertModel["kind"] =
			participantIdentities.length > 2 ? "GROUP" : "PRIVATE";
		const now = seed.createdAt;
		const dmKey =
			desiredConversationKind === "PRIVATE"
				? `${participantIdentities
						.map((i) => i.id)
						.sort()
						.join(":")}`
				: null;
		const threadLookupMessageIds =
			desiredConversationKind === "GROUP"
				? Array.from(
						new Set([
							...extractMessageIds(parsedEmail.inReplyTo),
							...extractMessageIds(parsedEmail.references),
						])
					)
				: [];
		const emailMetadata = {
			to,
			cc,
			bcc,
			replyTo,
			inReplyTo: parsedEmail.inReplyTo,
			messageId: parsedEmail.messageId,
			references: parsedEmail.references,
		} satisfies MessageInsertModel["emailMetadata"];

		let conversation: ConversationSelectModel | null = null;
		let persistedMessageId = ulid();
		let insertedMessage = false;
		let createdConversationId: string | null = null;

		await db.transaction(async (tx) => {
			if (seed.externalMessageId) {
				const existingMessage = await tx.query.messageTable.findFirst({
					columns: { id: true, conversationId: true },
					where: (t, { eq }) => eq(t.externalMessageId, seed.externalMessageId),
				});
				if (existingMessage) {
					const existingConversation = await tx.query.conversationTable.findFirst({
						where: (t, { eq }) => eq(t.id, existingMessage.conversationId),
					});
					if (!existingConversation) throw new Error("Missing conversation for existing message");
					conversation = existingConversation;
					persistedMessageId = existingMessage.id;
				}
			}

			if (!conversation) {
				if (desiredConversationKind === "PRIVATE") {
					if (!dmKey) throw new Error("Missing dmKey");
					conversation =
						(await tx.query.conversationTable.findFirst({
							where: (t, { eq }) => eq(t.dmKey, dmKey),
						})) ?? null;

					if (!conversation) {
						const inserted = await tx
							.insert(conversationTable)
							.values({
								id: ulid(),
								kind: "PRIVATE",
								title: parsedEmail.subject,
								dmKey,
							})
							.onConflictDoNothing({ target: conversationTable.dmKey })
							.returning();

						conversation =
							inserted[0] ??
							(await tx.query.conversationTable.findFirst({
								where: (t, { eq }) => eq(t.dmKey, dmKey),
							})) ??
							null;
					}
					if (!conversation) throw new Error("Failed to create conversation");
				} else {
					const threadConversationId = await findConversationIdByEmailThreadMessageIds(
						tx,
						threadLookupMessageIds
					);

					const existingThreadConversation = threadConversationId
						? await tx.query.conversationTable.findFirst({
								where: (t, { eq }) => eq(t.id, threadConversationId),
							})
						: null;

					if (existingThreadConversation && existingThreadConversation.kind === "GROUP") {
						conversation = existingThreadConversation;
					} else {
						const [created] = await tx
							.insert(conversationTable)
							.values({
								id: ulid(),
								kind: "GROUP",
								title: parsedEmail.subject,
							})
							.returning();
						if (!created) throw new Error("Failed to create conversation");
						conversation = created;
						createdConversationId = created.id;
					}
				}

				if (!conversation) throw new Error("Failed to resolve conversation");

				const inserted = await tx
					.insert(messageTable)
					.values({
						id: persistedMessageId,
						conversationId: conversation.id,
						senderIdentityId: senderIdentity.id,
						externalMessageId: seed.externalMessageId,
						bodyText: seed.bodyText,
						bodyHTML: seed.bodyHTML,
						createdAt: seed.createdAt,
						emailMetadata,
					})
					.onConflictDoNothing({ target: messageTable.externalMessageId })
					.returning({ id: messageTable.id });

				if (inserted.length) {
					insertedMessage = true;
				} else if (seed.externalMessageId) {
					const winner = await tx.query.messageTable.findFirst({
						columns: { id: true, conversationId: true },
						where: (t, { eq }) => eq(t.externalMessageId, seed.externalMessageId),
					});
					if (!winner) throw new Error("Expected existing message after conflict");

					if (createdConversationId && createdConversationId !== winner.conversationId) {
						await tx.delete(conversationTable).where(eq(conversationTable.id, createdConversationId));
					}

					const winnerConversation = await tx.query.conversationTable.findFirst({
						where: (t, { eq }) => eq(t.id, winner.conversationId),
					});
					if (!winnerConversation) throw new Error("Missing conversation for existing message");

					conversation = winnerConversation;
					persistedMessageId = winner.id;
				} else {
					throw new Error("Message insert returned no rows without an externalMessageId");
				}
			}

			if (!conversation) throw new Error("Missing conversation");
			const conversationId = conversation.id;

			await tx
				.insert(conversationParticipantTable)
				.values(
					participantIdentities.map((identity) => ({
						id: ulid(),
						conversationId,
						identityId: identity.id,
						role: DEFAULT_PARTICIPANT_ROLE,
						state: DEFAULT_PARTICIPANT_STATE,
						lastReadMessageId: null,
					}))
				)
				.onConflictDoNothing();

			const deliveries = participantIdentities
				.filter((identity) => identity.id !== senderIdentity.id)
				.map(
					(identity) =>
						({
							id: `${persistedMessageId}:${identity.id}`,
							messageId: persistedMessageId,
							recipientIdentityId: identity.id,
							status: "DELIVERED",
							transport: identity.kind === "GEBNA_USER" ? "GEBNA_DM" : "EMAIL",
						}) satisfies MessageDeliveryInsertModel
				);

			if (deliveries.length) {
				await tx.insert(messageDeliveryTable).values(deliveries).onConflictDoNothing();
			}

			if (insertedMessage) {
				await tx
					.update(conversationTable)
					.set({ updatedAt: now, lastMessageAt: now })
					.where(eq(conversationTable.id, conversationId));
			}

			const recipientIdentityId = participantIdentities.find(
				(i) => i.address.toLowerCase() === recipientEmail.toLowerCase()
			)?.id;
			const viewerStateUnread =
				recipientIdentityId && recipientIdentityId !== senderIdentity.id ? 1 : 0;

			await tx
				.insert(conversationViewerStateTable)
				.values({
					id: ulid(),
					ownerId: recipient.id,
					conversationId,
					mailbox: "IMPORTANT",
					unreadCount: viewerStateUnread,
				})
				.onConflictDoUpdate({
					target: [
						conversationViewerStateTable.ownerId,
						conversationViewerStateTable.conversationId,
					],
					set: {
						unreadCount: viewerStateUnread,
						updatedAt: now,
					},
				});
		});

		await env.QUEUE.sendBatch(
			uniqueParticipants.map((p) => ({
				body: {
					type: "infer-address-avatar",
					payload: {
						address: p.address!,
					},
				} satisfies InferAddressAvatarQueueMessage,
				contentType: "json",
			}))
		);

		if (insertedMessage) {
			messagesInserted += 1;
		} else {
			messagesSkipped += 1;
		}
	}

	return {
		status: "ok",
		resetPerformed: Boolean(options.reset),
		recipientUsername,
		recipientEmail,
		counts: {
			filesProcessed: seedEmails.length,
			filesSkipped: skippedFiles,
			messagesInserted,
			messagesSkipped,
			totalFiles,
			conversationsDeleted: resetCounts?.conversations,
			messagesDeleted: resetCounts?.messages,
			deliveriesDeleted: resetCounts?.deliveries,
			participantsDeleted: resetCounts?.participants,
			viewerStatesDeleted: resetCounts?.viewerStates,
		},
	};
}

async function loadSeedEmails(options: { limit?: number; offset?: number } = {}) {
	const files = rawEmailEntries
		.map((entry) => entry.fileName)
		.sort((a, b) => a.localeCompare(b));
	const totalFiles = files.length;
	const start = Math.max(options.offset ?? 0, 0);
	const end = options.limit && options.limit > 0 ? start + options.limit : totalFiles;
	const filesToParse = files.slice(start, end);
	const seedEmails: SeedEmail[] = [];
	let skippedFiles = 0;

	for (const fileName of filesToParse) {
		const rawText = rawEmailByName.get(fileName);
		if (typeof rawText !== "string") continue;

		const raw = encoder.encode(rawText);
		const parsedEmail = await PostalMime.parse(raw);
		const fromAddress = parsedEmail.from?.address?.trim();
		if (!fromAddress) {
			skippedFiles += 1;
			continue;
		}

		const cidResolver = buildCidResolver(parsedEmail.attachments ?? []);
		const normalizedBody = normalizeAndSanitizeEmailBody(parsedEmail, {
			cidResolver,
			blockRemoteImagesByDefault: false,
			allowDataImages: Boolean(cidResolver),
		});

		const externalMessageId =
			extractMessageIds(parsedEmail.messageId)[0] ?? (await makeSeedMessageId(raw));

		seedEmails.push({
			fileName,
			parsedEmail,
			createdAt: coerceDate(parsedEmail.date),
			externalMessageId,
			bodyText: normalizedBody?.plain ?? null,
			bodyHTML: normalizedBody?.html ?? null,
		});
	}

	return { seedEmails, skippedFiles, totalFiles };
}

async function deleteSeededRecords(
	db: ReturnType<typeof getDB>,
	seedEmails: SeedEmail[]
) {
	const externalMessageIds = unique(seedEmails.map((seed) => seed.externalMessageId));
	if (!externalMessageIds.length) {
		return {
			messages: 0,
			deliveries: 0,
			conversations: 0,
			participants: 0,
			viewerStates: 0,
		};
	}

	return db.transaction(async (tx) => {
		const existingMessages = await tx.query.messageTable.findMany({
			columns: { id: true, conversationId: true },
			where: (t, { inArray }) => inArray(t.externalMessageId, externalMessageIds),
		});
		const messageIds = existingMessages.map((message) => message.id);
		const conversationIds = unique(existingMessages.map((message) => message.conversationId));

		let deliveriesDeleted = 0;
		if (messageIds.length) {
			const deliveries = await tx.query.messageDeliveryTable.findMany({
				columns: { id: true },
				where: (t, { inArray }) => inArray(t.messageId, messageIds),
			});
			deliveriesDeleted = deliveries.length;
			await tx.delete(messageDeliveryTable).where(inArray(messageDeliveryTable.messageId, messageIds));
			await tx.delete(messageTable).where(inArray(messageTable.id, messageIds));
		}

		let conversationsDeleted = 0;
		let participantsDeleted = 0;
		let viewerStatesDeleted = 0;

		if (conversationIds.length) {
			const remainingConversationRows = await tx.query.messageTable.findMany({
				columns: { conversationId: true },
				where: (t, { inArray }) => inArray(t.conversationId, conversationIds),
			});
			const remainingConversations = new Set(
				remainingConversationRows.map((row) => row.conversationId)
			);
			const emptyConversationIds = conversationIds.filter(
				(id) => !remainingConversations.has(id)
			);

			if (emptyConversationIds.length) {
				const participantRows = await tx.query.conversationParticipantTable.findMany({
					columns: { id: true },
					where: (t, { inArray }) => inArray(t.conversationId, emptyConversationIds),
				});
				const viewerStateRows = await tx.query.conversationViewerStateTable.findMany({
					columns: { id: true },
					where: (t, { inArray }) => inArray(t.conversationId, emptyConversationIds),
				});

				participantsDeleted = participantRows.length;
				viewerStatesDeleted = viewerStateRows.length;

				await tx
					.delete(conversationParticipantTable)
					.where(inArray(conversationParticipantTable.conversationId, emptyConversationIds));
				await tx
					.delete(conversationViewerStateTable)
					.where(inArray(conversationViewerStateTable.conversationId, emptyConversationIds));
				await tx.delete(conversationTable).where(inArray(conversationTable.id, emptyConversationIds));
				conversationsDeleted = emptyConversationIds.length;
			}
		}

		return {
			messages: existingMessages.length,
			deliveries: deliveriesDeleted,
			conversations: conversationsDeleted,
			participants: participantsDeleted,
			viewerStates: viewerStatesDeleted,
		};
	});
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
