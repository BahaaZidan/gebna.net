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
		emailThreads: r.many.emailThreads({
			from: r.users.id,
			to: r.emailThreads.ownerId,
		}),
		ownAddressRef: r.one.emailAddressRefs({
			from: [r.users.id, r.users.email],
			to: [r.emailAddressRefs.ownerId, r.emailAddressRefs.address],
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
		emailThreads: r.many.emailThreads({
			from: r.emailAddressRefs.id.through(r.emailThreadParticipants.emailAddressRefId),
			to: r.emailThreads.id.through(r.emailThreadParticipants.threadId),
		}),
	},
	emailThreads: {
		owner: r.one.users({
			from: r.emailThreads.ownerId,
			to: r.users.id,
		}),
		messages: r.many.emailMessages({
			from: r.emailThreads.id,
			to: r.emailMessages.threadId,
		}),
		lastMessage: r.one.emailMessages({
			from: r.emailThreads.lastMessageId,
			to: r.emailMessages.id,
		}),
		participants: r.many.emailAddressRefs(),
	},
	emailMessages: {
		owner: r.one.users({
			from: r.emailMessages.ownerId,
			to: r.users.id,
		}),
		thread: r.one.emailThreads({
			from: r.emailMessages.threadId,
			to: r.emailThreads.id,
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
