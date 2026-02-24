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
		emailConversations: r.many.emailConversations({
			from: r.users.id,
			to: r.emailConversations.ownerId,
		}),
		emailAddressRefs: r.many.emailAddressRefs({
			from: r.users.id,
			to: r.emailAddressRefs.ownerId,
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
	emailAddresses: {},
	emailAddressRefs: {
		address_: r.one.emailAddresses({
			from: r.emailAddressRefs.address,
			to: r.emailAddresses.address,
		}),
		owner: r.one.users({
			from: r.emailAddressRefs.ownerId,
			to: r.users.id,
		}),
		emailConversations: r.many.emailConversations({
			from: r.emailAddressRefs.id.through(r.emailConversationParticipants.emailAddressRefId),
			to: r.emailConversations.id.through(r.emailConversationParticipants.conversationId),
		}),
	},
	emailConversations: {
		owner: r.one.users({
			from: r.emailConversations.ownerId,
			to: r.users.id,
		}),
		messages: r.many.emailMessages({
			from: r.emailConversations.id,
			to: r.emailMessages.conversationId,
		}),
		lastMessage: r.one.emailMessages({
			from: r.emailConversations.lastMessageId,
			to: r.emailMessages.id,
		}),
		participants: r.many.emailAddressRefs(),
	},
	emailMessages: {
		owner: r.one.users({
			from: r.emailMessages.ownerId,
			to: r.users.id,
		}),
		conversation: r.one.emailConversations({
			from: r.emailMessages.conversationId,
			to: r.emailConversations.id,
		}),
		fromRef: r.one.emailAddressRefs({
			from: [r.emailMessages.ownerId, r.emailMessages.from],
			to: [r.emailAddressRefs.ownerId, r.emailAddressRefs.address],
		}),
		toRef: r.one.emailAddressRefs({
			from: [r.emailMessages.ownerId, r.emailMessages.to],
			to: [r.emailAddressRefs.ownerId, r.emailAddressRefs.address],
		}),
	},
}));
