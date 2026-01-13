import { and, desc, eq, lt, sql } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { DateTimeResolver } from "graphql-scalars";
import { ulid } from "ulid";

import { DBInstance, IdentityInsertModel, TransactionInstance } from "$lib/db";
import {
	conversationParticipantTable,
	conversationTable,
	conversationViewerStateTable,
	identityRelationshipTable,
	identityTable,
	messageDeliveryTable,
	messageTable,
} from "$lib/db/schema";

import type { Resolvers, ResolversTypes } from "./resolvers.types";
import { fromGlobalId, toGlobalId } from "./utils";

const DEFAULT_MAILBOX: ResolversTypes["Mailbox"] = "IMPORTANT";
const DEFAULT_PARTICIPANT_ROLE: ResolversTypes["ParticipantRole"] = "MEMBER";
const DEFAULT_PARTICIPANT_STATE: ResolversTypes["ParticipantState"] = "ACTIVE";

async function getConversationParticipants(db: DBInstance, conversationId: string) {
	return db
		.select({ participant: conversationParticipantTable, identity: identityTable })
		.from(conversationParticipantTable)
		.innerJoin(identityTable, eq(identityTable.id, conversationParticipantTable.identityId))
		.where(eq(conversationParticipantTable.conversationId, conversationId));
}

function transportForIdentity(identity: {
	kind: ResolversTypes["IdentityKind"];
}): ResolversTypes["Transport"] {
	return identity.kind === "GEBNA_USER" ? "GEBNA_DM" : "EMAIL";
}

async function upsertViewerState({
	tx,
	conversationId,
	ownerId,
	mailbox = DEFAULT_MAILBOX,
	unreadCount,
}: {
	tx: TransactionInstance | DBInstance;
	conversationId: string;
	ownerId: string;
	mailbox?: ResolversTypes["Mailbox"];
	unreadCount?: number;
}) {
	const [viewerState] = await tx
		.insert(conversationViewerStateTable)
		.values({
			id: ulid(),
			ownerId,
			conversationId,
			mailbox,
			unreadCount: unreadCount ?? 0,
		})
		.onConflictDoUpdate({
			target: [conversationViewerStateTable.ownerId, conversationViewerStateTable.conversationId],
			set: {
				...(unreadCount !== undefined ? { unreadCount } : {}),
				...(mailbox ? { mailbox } : {}),
				updatedAt: new Date(),
			},
		})
		.returning();

	return viewerState;
}

export const resolvers: Resolvers = {
	Query: {
		viewer: async (_parent, _args, { viewer }) => viewer.user,
		node: async (_parent, args, { viewer, db }) => {
			const { type, id } = fromGlobalId(args.id);

			switch (type) {
				case "Conversation": {
					const conversation = await db.query.conversationTable.findFirst({
						where: (t, { eq }) => eq(t.id, id),
					});
					if (!conversation) return null;

					const participant = await db.query.conversationParticipantTable.findFirst({
						where: (t, { and, eq }) =>
							and(eq(t.conversationId, id), eq(t.identityId, viewer.identity.id)),
					});

					return participant ? { ...conversation, __typename: "Conversation" } : null;
				}
				case "Identity": {
					const identity = await db.query.identityTable.findFirst({
						where: (t, { eq }) => eq(t.id, id),
					});
					return identity ? { ...identity, __typename: "Identity" } : null;
				}
				default:
					return null;
			}
		},
	},
	Mutation: {
		upsertConversation: async (_parent, { input }, { viewer, db }) => {
			const addresses = input.participantAddresses
				.map((a) => a.trim().toLowerCase())
				.filter((a) => a.length);
			if (!addresses.length) throw new GraphQLError("BAD_INPUT");
			if (input.kind === "PRIVATE" && addresses.length !== 1)
				throw new GraphQLError("PRIVATE conversations require exactly one participant address");

			const identities = Array.from(new Set(addresses)).map((address) => {
				return {
					id: ulid(),
					address,
					kind: address.endsWith("@gebna.net") ? "GEBNA_USER" : "EXTERNAL_EMAIL",
				} satisfies IdentityInsertModel;
			});

			return await db.transaction(async (tx) => {
				await tx.insert(identityTable).values(identities).onConflictDoNothing();
				const participantIdentities = await tx.query.identityTable.findMany({
					where: (t) =>
						identities.length === 0
							? sql`0`
							: sql`
								(${t.kind}, ${t.address})
								IN (
									VALUES ${sql.join(
										identities.map((p) => sql`(${p.kind}, ${p.address})`),
										sql`, `
									)}
								)
							`,
				});
				const allIdentities = [viewer.identity, ...participantIdentities];

				let dmKey: string | null = null;
				if (input.kind === "PRIVATE") {
					const otherId = participantIdentities[0]?.id;
					if (!otherId) throw new Error("Missing participant");
					const [a, b] = [viewer.identity.id, otherId].sort();
					dmKey = `${a}:${b}`;
				}

				const now = new Date();
				let conversation =
					(dmKey &&
						(await db.query.conversationTable.findFirst({
							where: (t, { eq }) => eq(t.dmKey, dmKey),
						}))) ||
					null;

				let created = false;
				if (!conversation) {
					const [inserted] = await db
						.insert(conversationTable)
						.values({
							id: ulid(),
							kind: input.kind,
							title: input.title,
							dmKey,
							createdAt: now,
							updatedAt: now,
							lastMessageAt: null,
						})
						.returning();
					conversation = inserted;
					created = true;
				}

				const participantRows = allIdentities.map(
					(identity) =>
						({
							id: ulid(),
							conversationId: conversation.id,
							identityId: identity.id,
							role: DEFAULT_PARTICIPANT_ROLE,
							state: DEFAULT_PARTICIPANT_STATE,
							joinedAt: now,
							lastReadMessageId: null,
						}) satisfies typeof conversationParticipantTable.$inferInsert
				);
				await tx.insert(conversationParticipantTable).values(participantRows).onConflictDoNothing();
				await upsertViewerState({
					tx,
					conversationId: conversation.id,
					ownerId: viewer.user.id,
					unreadCount: 0,
				});

				return { conversation, created };
			});
		},
		sendMessage: async (_parent, { input }, { viewer, db }) => {
			const rawConversationId = fromGlobalId(input.conversationId).id;
			const conversation = await db.query.conversationTable.findFirst({
				where: (t, { eq }) => eq(t.id, rawConversationId),
			});
			if (!conversation) throw new Error("Conversation not found");

			const participants = await getConversationParticipants(db, rawConversationId);
			const activeParticipants = participants.filter(
				({ participant }) => participant.state === DEFAULT_PARTICIPANT_STATE
			);
			const senderParticipant = activeParticipants.find(
				({ participant }) => participant.identityId === viewer.identity.id
			);
			if (!senderParticipant) throw new Error("Sender is not a participant in this conversation");

			const recipients = activeParticipants.filter(
				({ participant }) => participant.identityId !== viewer.identity.id
			);

			const now = new Date();
			const messageId = `cm:${rawConversationId}:${input.clientMutationId}`;

			let message =
				(await db.query.messageTable.findFirst({
					where: (t, { eq }) => eq(t.id, messageId),
				})) || null;

			if (!message) {
				await db.transaction(async (tx) => {
					const [createdMessage] = await tx
						.insert(messageTable)
						.values({
							id: messageId,
							conversationId: rawConversationId,
							senderIdentityId: viewer.identity.id,
							bodyText: input.bodyText,
							bodyHTML: null,
							createdAt: now,
						})
						.returning();

					message = createdMessage;

					if (recipients.length) {
						const deliveries = recipients.map(({ participant, identity }) => ({
							id: ulid(),
							messageId,
							recipientIdentityId: participant.identityId,
							status: "QUEUED" as const,
							transport: transportForIdentity(identity),
							latestStatusChangeAt: now,
							error: null,
						}));

						await tx.insert(messageDeliveryTable).values(deliveries).onConflictDoNothing();
					}

					await tx
						.update(conversationTable)
						.set({ updatedAt: now, lastMessageAt: now })
						.where(eq(conversationTable.id, rawConversationId));
				});
			} else {
				// Ensure deliveries exist for all recipients when retrying the same mutation.
				const existingDeliveries = await db.query.messageDeliveryTable.findMany({
					where: (t, { eq }) => eq(t.messageId, messageId),
				});
				const existingRecipientIds = new Set(existingDeliveries.map((d) => d.recipientIdentityId));
				const missingRecipients = recipients.filter(
					({ participant }) => !existingRecipientIds.has(participant.identityId)
				);
				if (missingRecipients.length) {
					await db.insert(messageDeliveryTable).values(
						missingRecipients.map(({ participant, identity }) => ({
							id: ulid(),
							messageId,
							recipientIdentityId: participant.identityId,
							status: "QUEUED" as const,
							transport: transportForIdentity(identity),
							latestStatusChangeAt: now,
							error: null,
						}))
					);
				}
			}

			if (!message) throw new Error("Failed to create message");

			return {
				clientMutationId: input.clientMutationId,
				message,
			};
		},
		markConversationRead: async (_parent, { input }, { viewer, db }) => {
			const rawConversationId = fromGlobalId(input.conversationId).id;
			const rawMessageId = fromGlobalId(input.lastReadMessageId).id;

			return await db.transaction(async (tx) => {
				const conversation = await tx.query.conversationTable.findFirst({
					where: (t, { eq }) => eq(t.id, rawConversationId),
				});
				if (!conversation) throw new Error("Conversation not found");

				await tx
					.update(conversationParticipantTable)
					.set({ lastReadMessageId: rawMessageId })
					.where(
						and(
							eq(conversationParticipantTable.conversationId, rawConversationId),
							eq(conversationParticipantTable.identityId, viewer.identity.id)
						)
					);

				await upsertViewerState({
					tx,
					conversationId: rawConversationId,
					ownerId: viewer.user.id,
					unreadCount: 0,
				});

				return { conversation };
			});
		},
		setContactStatus: async (_parent, { input }, { viewer, db }) => {
			const identityId = fromGlobalId(input.identityId).id;

			const [upserted] = await db
				.insert(identityRelationshipTable)
				.values({
					id: ulid(),
					ownerId: viewer.user.id,
					identityId,
					isContact: input.isContact,
					displayName: input.displayName,
					avatarUrl: input.avatarUrl,
				})
				.onConflictDoUpdate({
					target: [identityRelationshipTable.ownerId, identityRelationshipTable.identityId],
					set: {
						isContact: input.isContact,
						displayName: input.displayName,
						avatarUrl: input.avatarUrl,
						updatedAt: new Date(),
					},
				})
				.returning();

			return await db.query.identityTable.findFirst({
				where: (t, { eq }) => eq(t.id, upserted.identityId),
			});
		},
		moveConversation: async (_parent, { input }, { viewer, db }) => {
			const rawConversationId = fromGlobalId(input.conversationId).id;
			const conversation = await db.query.conversationTable.findFirst({
				where: (t, { eq }) => eq(t.id, rawConversationId),
			});
			if (!conversation) return null;

			await upsertViewerState({
				tx: db,
				conversationId: rawConversationId,
				ownerId: viewer.user.id,
				mailbox: input.mailbox,
			});

			return conversation;
		},
	},
	Node: {
		__resolveType(parent) {
			return parent.__typename;
		},
	},
	DateTime: DateTimeResolver,
	Conversation: {
		id: (parent) => toGlobalId("Conversation", parent.id),
		participants: async (parent, _args, { db }) => {
			const participants = await getConversationParticipants(db, parent.id);
			return participants.map(({ participant }) => participant);
		},
		lastMessage: async (parent, _args, { db }) => {
			const message = await db.query.messageTable.findFirst({
				where: (t, { eq }) => eq(t.conversationId, parent.id),
				orderBy: (t, { desc }) => desc(t.createdAt),
			});
			if (!message) throw new Error("Conversation has no messages");
			return message;
		},
		viewerState: async (parent, _args, { viewer, db }) => {
			const viewerState = await db.query.conversationViewerStateTable.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.ownerId, viewer.user.id), eq(t.conversationId, parent.id)),
			});
			return viewerState ?? { mailbox: DEFAULT_MAILBOX, unreadCount: 0 };
		},
		messages: async (parent, args, { db }) => {
			const pageSize = args.last;
			const beforeId = args.before ? fromGlobalId(args.before).id : null;
			let beforeCreatedAt: Date | null = null;

			if (beforeId) {
				const beforeMessage = await db.query.messageTable.findFirst({
					where: (t, { eq }) => eq(t.id, beforeId),
				});
				beforeCreatedAt = beforeMessage?.createdAt ?? null;
			}

			const messagesPlusOne = await db.query.messageTable.findMany({
				where: (t, { and, eq, lt }) =>
					and(
						eq(t.conversationId, parent.id),
						beforeCreatedAt ? lt(t.createdAt, beforeCreatedAt) : undefined
					),
				orderBy: (t, { desc }) => desc(t.createdAt),
				limit: pageSize + 1,
			});

			const messages = messagesPlusOne.slice(0, pageSize);
			return {
				edges: messages.map((node) => ({
					node,
					cursor: toGlobalId("Message", node.id),
				})),
				pageInfo: {
					hasNextPage: messagesPlusOne.length > messages.length,
					endCursor: messages.length
						? toGlobalId("Message", messages[messages.length - 1].id)
						: null,
				},
			};
		},
	},
	ConversationParticipant: {
		identity: async (parent, _args, { db }) => {
			const identity = await db.query.identityTable.findFirst({
				where: (t, { eq }) => eq(t.id, parent.identityId),
			});
			if (!identity) throw new Error("Identity not found");
			return identity;
		},
		lastReadMessageId: (parent) =>
			parent.lastReadMessageId && toGlobalId("Message", parent.lastReadMessageId),
	},
	Message: {
		id: (parent) => toGlobalId("Message", parent.id),
		conversationId: (parent) => toGlobalId("Conversation", parent.conversationId),
		sender: async (parent, _args, { db }) => {
			const identity = await db.query.identityTable.findFirst({
				where: (t, { eq }) => eq(t.id, parent.senderIdentityId),
			});
			if (!identity) throw new Error("Sender identity not found");
			return identity;
		},
		delivery: async (parent, _args, { db }) => {
			return db.query.messageDeliveryTable.findMany({
				where: (t, { eq }) => eq(t.messageId, parent.id),
				orderBy: (t, { desc }) => desc(t.latestStatusChangeAt),
			});
		},
	},
	DeliveryReceipt: {
		recipient: async (parent, _args, { db }) => {
			const identity = await db.query.identityTable.findFirst({
				where: (t, { eq }) => eq(t.id, parent.recipientIdentityId),
			});
			if (!identity) throw new Error("Recipient not found");
			return identity;
		},
	},
	Identity: {
		id: (parent) => toGlobalId("Identity", parent.id),
		relationshipToViewer: async (parent, _args, { viewer, db }) => {
			return await db.query.identityRelationshipTable.findFirst({
				where: (t, { and, eq }) => and(eq(t.ownerId, viewer.user.id), eq(t.identityId, parent.id)),
			});
		},
	},
	IdentityRelationship: {
		id: (parent, _, { viewer }) =>
			toGlobalId("IdentityRelationship", `${viewer.user.id}:${parent.id}`),
	},
	Viewer: {
		id: (parent) => toGlobalId("Viewer", parent.id),
		conversationsByMailbox: async (parent, args, { viewer, db }) => {
			const pageSize = args.first;
			const afterId = args.after ? fromGlobalId(args.after).id : null;

			const rows = await db
				.select({ conversation: conversationTable, state: conversationViewerStateTable })
				.from(conversationParticipantTable)
				.innerJoin(
					conversationTable,
					eq(conversationTable.id, conversationParticipantTable.conversationId)
				)
				.leftJoin(
					conversationViewerStateTable,
					and(
						eq(conversationViewerStateTable.conversationId, conversationTable.id),
						eq(conversationViewerStateTable.ownerId, parent.id)
					)
				)
				.where(
					and(
						eq(conversationParticipantTable.identityId, viewer.identity.id),
						args.mailbox === DEFAULT_MAILBOX
							? undefined
							: eq(conversationViewerStateTable.mailbox, args.mailbox),
						afterId ? lt(conversationTable.id, afterId) : undefined
					)
				)
				.orderBy(desc(conversationTable.updatedAt))
				.limit(pageSize + 1);

			const conversations = rows.slice(0, pageSize).map((row) => row.conversation);
			return {
				edges: conversations.map((node) => ({
					node,
					cursor: toGlobalId("Conversation", node.id),
				})),
				pageInfo: {
					hasNextPage: rows.length > conversations.length,
					endCursor: conversations.length
						? toGlobalId("Conversation", conversations[conversations.length - 1].id)
						: null,
				},
			};
		},
		contacts: async (parent, args, { db }) => {
			const pageSize = args.first;
			const afterId = args.after ? fromGlobalId(args.after).id : null;

			const relationshipsPlusOne = await db.query.identityRelationshipTable.findMany({
				where: (t, { and, eq, lt }) =>
					and(
						eq(t.ownerId, parent.id),
						eq(t.isContact, true),
						afterId ? lt(t.id, afterId) : undefined,
						args.query ? undefined : undefined
					),
				orderBy: (t, { desc }) => desc(t.updatedAt),
				limit: pageSize + 1,
			});

			const relationships = relationshipsPlusOne.slice(0, pageSize);
			const identityIds = relationships.map((rel) => rel.identityId);
			const identities = identityIds.length
				? await db.query.identityTable.findMany({
						where: (t, { inArray }) => inArray(t.id, identityIds),
					})
				: [];
			const identityById = new Map(identities.map((identity) => [identity.id, identity]));

			return {
				edges: relationships.map((rel) => ({
					node: identityById.get(rel.identityId)!,
					cursor: toGlobalId("IdentityRelationship", rel.id),
				})),
				pageInfo: {
					hasNextPage: relationshipsPlusOne.length > relationships.length,
					endCursor: relationships.length
						? toGlobalId("IdentityRelationship", relationships[relationships.length - 1].id)
						: null,
				},
			};
		},
	},
};
