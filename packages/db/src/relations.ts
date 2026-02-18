import { defineRelations } from "drizzle-orm";

import * as schema from "./schema.js";

export const relations = defineRelations(schema, (r) => ({
	users: {
		sessions: r.many.sessions({
			from: r.users.id,
			to: r.sessions.userId,
		}),
		accounts: r.many.accounts({
			from: r.users.id,
			to: r.accounts.userId,
		}),
		relationships: r.many.identityRelationships({
			from: r.users.id,
			to: r.identityRelationships.ownerId,
		}),
		identity: r.one.identities({
			from: r.users.id,
			to: r.identities.ownerId,
		}),
	},
	sessions: {
		users: r.one.users({
			from: r.sessions.userId,
			to: r.users.id,
		}),
	},
	accounts: {
		users: r.one.users({
			from: r.accounts.userId,
			to: r.users.id,
		}),
	},
	identities: {
		owner: r.one.users({
			from: r.identities.ownerId,
			to: r.users.id,
		}),
		relationships: r.many.identityRelationships({
			from: r.identities.id,
			to: r.identityRelationships.identityId,
		}),
		participations: r.many.conversationParticipants({
			from: r.identities.id,
			to: r.conversationParticipants.identityId,
		}),
	},
	identityRelationships: {
		owner: r.one.users({
			from: r.identityRelationships.ownerId,
			to: r.users.id,
		}),
		identity: r.one.identities({
			from: r.identityRelationships.identityId,
			to: r.identities.id,
		}),
	},
	conversations: {
		participants: r.many.conversationParticipants({
			from: r.conversations.id,
			to: r.conversationParticipants.conversationId,
		}),
		messages: r.many.messages({
			from: r.conversations.id,
			to: r.messages.conversationId,
		}),
		viewerStates: r.many.conversationViewerStates({
			from: r.conversations.id,
			to: r.conversationViewerStates.conversationId,
		}),
		lastMessage: r.one.messages({
			from: r.conversations.lastMessageId,
			to: r.messages.id,
		}),
	},
	conversationParticipants: {
		conversation: r.one.conversations({
			from: r.conversationParticipants.conversationId,
			to: r.conversations.id,
		}),
		identity: r.one.identities({
			from: r.conversationParticipants.identityId,
			to: r.identities.id,
		}),
		owner: r.one.users({
			from: r.conversationParticipants.ownerId,
			to: r.users.id,
		}),
	},
	conversationViewerStates: {
		conversation: r.one.conversations({
			from: r.conversationViewerStates.conversationId,
			to: r.conversations.id,
		}),
		owner: r.one.users({
			from: r.conversationViewerStates.ownerId,
			to: r.users.id,
		}),
	},
	messages: {
		conversation: r.one.conversations({
			from: r.messages.conversationId,
			to: r.conversations.id,
		}),
		senderIdentity: r.one.identities({
			from: r.messages.senderIdentityId,
			to: r.identities.id,
		}),
		deliveries: r.many.messageDeliveries({
			from: r.messages.id,
			to: r.messageDeliveries.messageId,
		}),
	},
	messageDeliveries: {
		message: r.one.messages({
			from: r.messageDeliveries.messageId,
			to: r.messages.id,
		}),
		recipientIdentity: r.one.identities({
			from: r.messageDeliveries.recipientIdentityId,
			to: r.identities.id,
		}),
	},
}));
