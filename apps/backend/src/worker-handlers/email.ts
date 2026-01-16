import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import PostalMime from "postal-mime";
import { ulid } from "ulid";

import {
	ConversationInsertModel,
	ConversationParticipantInsertModel,
	ConversationSelectModel,
	getDB,
	IdentityInsertModel,
	MessageDeliveryInsertModel,
	MessageInsertModel,
	TransactionInstance,
} from "$lib/db";
import {
	conversationParticipantTable,
	conversationTable,
	conversationViewerStateTable,
	identityTable,
	messageDeliveryTable,
	messageTable,
} from "$lib/db/schema";
import { getConversationPubSub } from "$lib/graphql/pubsub";
import { extractLocalPart } from "$lib/utils/email";
import { buildCidResolver } from "$lib/utils/email-attachments";
import { normalizeAndSanitizeEmailBody } from "$lib/utils/email-html-normalization";

const DEFAULT_PARTICIPANT_ROLE: ConversationParticipantInsertModel["role"] = "MEMBER";
const DEFAULT_PARTICIPANT_STATE: ConversationParticipantInsertModel["state"] = "ACTIVE";

function normalizeAddress(address: string) {
	return address.trim().toLowerCase();
}

function extractMessageIds(headerValue?: string | null): string[] {
	if (!headerValue) return [];
	const matches =
		headerValue
			.match(/<[^>]+>/g)
			?.map((m) => m.trim())
			.filter(Boolean) ?? [];
	if (matches.length) return matches;
	const fallback = headerValue.trim();
	return fallback ? [fallback] : [];
}

function identityKindFor(address: string): IdentityInsertModel["kind"] {
	return address.endsWith("@gebna.net") ? "GEBNA_USER" : "EXTERNAL_EMAIL";
}

type IdentitySelect = typeof identityTable.$inferSelect;
type IdentityKey = `${IdentityInsertModel["kind"]}:${string}`;

async function ensureIdentities(
	db: ReturnType<typeof getDB>,
	addresses: string[]
): Promise<IdentitySelect[]> {
	const unique = new Map<IdentityKey, IdentityInsertModel>();

	for (const address of addresses) {
		const normalized = normalizeAddress(address);
		if (!normalized) continue;
		const kind = identityKindFor(normalized);
		const key = `${kind}:${normalized}` as const;
		if (unique.has(key)) continue;
		unique.set(key, {
			id: ulid(),
			address: normalized,
			kind,
		});
	}

	const toInsert = Array.from(unique.values());
	if (!toInsert.length) return [];

	await db
		.insert(identityTable)
		.values(toInsert)
		.onConflictDoNothing({ target: [identityTable.kind, identityTable.address] });

	const rows = await db.query.identityTable.findMany({
		where: (t) =>
			sql`
				(${t.kind}, ${t.address})
				IN (
					VALUES ${sql.join(
						toInsert.map((p) => sql`(${p.kind}, ${p.address})`),
						sql`, `
					)}
				)
			`,
	});

	if (rows.length !== toInsert.length) throw new Error("Failed to ensure identities");
	return rows;
}

function transportForIdentity(identity: { kind: IdentityInsertModel["kind"] }) {
	return identity.kind === "GEBNA_USER" ? "GEBNA_DM" : "EMAIL";
}

async function findConversationIdByEmailThreadMessageIds(
	db: TransactionInstance | ReturnType<typeof getDB>,
	threadMessageIds: string[]
): Promise<string | null> {
	if (!threadMessageIds.length) return null;
	const row = await db.query.messageTable.findFirst({
		columns: { conversationId: true },
		where: (t) =>
			and(isNotNull(t.externalMessageId), inArray(t.externalMessageId, threadMessageIds)),
		orderBy: (t) => [desc(t.createdAt)],
	});

	return row?.conversationId ?? null;
}

export async function emailHandler(
	envelope: ForwardableEmailMessage,
	bindings: CloudflareBindings,
	executionCtx: ExecutionContext
) {
	const db = getDB(bindings);
	const pubsub = getConversationPubSub(bindings, executionCtx);

	const recipientLocal = extractLocalPart(envelope.to);
	const recipientUser = await db.query.userTable.findFirst({
		where: (t, { eq }) => eq(t.username, recipientLocal),
	});
	if (!recipientUser) return envelope.setReject("ADDRESS NOT FOUND!");

	const parsedEmail = await PostalMime.parse(envelope.raw);
	if (!parsedEmail.from?.address) return envelope.setReject("FROM NOT SET!");
	const externalMessageId = extractMessageIds(parsedEmail.messageId)[0];
	if (!parsedEmail.messageId || !externalMessageId?.length)
		return envelope.setReject("MISSING MESSAGE-ID");

	const cidResolver = buildCidResolver(parsedEmail.attachments);
	const normalizedBody = normalizeAndSanitizeEmailBody(parsedEmail, {
		cidResolver,
		blockRemoteImagesByDefault: false,
		allowDataImages: Boolean(cidResolver),
	});

	const fromAddress = normalizeAddress(parsedEmail.from.address);

	const to = (parsedEmail.to ?? [])
		.map((a) => a.address)
		.filter(Boolean)
		.map(normalizeAddress);
	const cc = (parsedEmail.cc ?? [])
		.map((a) => a.address)
		.filter(Boolean)
		.map(normalizeAddress);
	const bcc = (parsedEmail.bcc ?? [])
		.map((a) => a.address)
		.filter(Boolean)
		.map(normalizeAddress);
	const replyTo = (parsedEmail.replyTo ?? [])
		.map((a) => a.address)
		.filter(Boolean)
		.map(normalizeAddress);

	const envelopeToAddress = normalizeAddress(envelope.to);

	const participantAddresses = Array.from(
		new Set([fromAddress, ...to, ...cc, ...bcc, ...replyTo, envelopeToAddress])
	).filter(Boolean);

	const participantIdentities = await ensureIdentities(db, participantAddresses);
	const senderIdentity =
		participantIdentities.find(
			(i) => i.kind === identityKindFor(fromAddress) && i.address === fromAddress
		) ?? null;
	if (!senderIdentity) throw new Error("Missing sender identity");

	const desiredConversationKind: ConversationInsertModel["kind"] =
		participantIdentities.length > 2 ? "GROUP" : "PRIVATE";
	const now = new Date();
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
	let createdDeliveries = false;
	let conversationIdForPublish: string | null = null;

	await db.transaction(async (tx) => {
		if (externalMessageId) {
			const existingMessage = await tx.query.messageTable.findFirst({
				columns: { id: true, conversationId: true },
				where: (t, { eq }) => eq(t.externalMessageId, externalMessageId),
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

			const inserted =
				externalMessageId === null
					? await tx
							.insert(messageTable)
							.values({
								id: persistedMessageId,
								conversationId: conversation.id,
								senderIdentityId: senderIdentity.id,
								externalMessageId,
								bodyText: normalizedBody?.plain,
								bodyHTML: normalizedBody?.html,
								emailMetadata,
							})
							.returning({ id: messageTable.id })
					: await tx
							.insert(messageTable)
							.values({
								id: persistedMessageId,
								conversationId: conversation.id,
								senderIdentityId: senderIdentity.id,
								externalMessageId,
								bodyText: normalizedBody?.plain,
								bodyHTML: normalizedBody?.html,
								emailMetadata,
							})
							.onConflictDoNothing({ target: messageTable.externalMessageId })
							.returning({ id: messageTable.id });

			if (inserted.length) {
				insertedMessage = true;
			} else if (externalMessageId) {
				const winner = await tx.query.messageTable.findFirst({
					columns: { id: true, conversationId: true },
					where: (t, { eq }) => eq(t.externalMessageId, externalMessageId),
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
		conversationIdForPublish = conversationId;

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
						transport: transportForIdentity(identity),
					}) satisfies MessageDeliveryInsertModel
			);

		if (deliveries.length) {
			await tx.insert(messageDeliveryTable).values(deliveries).onConflictDoNothing();
			createdDeliveries = true;
		}

		if (insertedMessage) {
			await tx
				.update(conversationTable)
				.set({ updatedAt: now, lastMessageAt: now })
				.where(eq(conversationTable.id, conversationId));
		}

		const recipientIdentityId = participantIdentities.find(
			(i) => i.address === envelopeToAddress
		)?.id;
		const viewerStateUnread =
			recipientIdentityId && recipientIdentityId !== senderIdentity.id ? 1 : 0;

		await tx
			.insert(conversationViewerStateTable)
			.values({
				id: ulid(),
				ownerId: recipientUser.id,
				conversationId,
				mailbox: "IMPORTANT",
				unreadCount: viewerStateUnread,
			})
			.onConflictDoUpdate({
				target: [conversationViewerStateTable.ownerId, conversationViewerStateTable.conversationId],
				set: {
					unreadCount: viewerStateUnread,
					updatedAt: now,
				},
			});
	});

	if (insertedMessage && conversationIdForPublish) {
		await pubsub.publish("messageAdded", {
			conversationId: conversationIdForPublish,
			messageId: persistedMessageId,
		});
		await pubsub.publish("conversationUpdated", { conversationId: conversationIdForPublish });
	}
	if ((insertedMessage || createdDeliveries) && conversationIdForPublish) {
		await pubsub.publish("deliveryUpdated", {
			conversationId: conversationIdForPublish,
			messageId: persistedMessageId,
		});
	}
}
