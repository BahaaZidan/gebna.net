import { DateTimeResolver, URLResolver } from "graphql-scalars";

import type { Resolvers } from "./resolvers.types";
import { toGlobalId } from "./utils";

export const resolvers: Resolvers = {
	DateTime: DateTimeResolver,
	URL: URLResolver,
	Query: {
		viewer: async (_parent, _input, { session, db }) => {
			if (!session) return null;
			const currentUser = db.query.userTable.findFirst({
				where: (t, { eq }) => eq(t.id, session.userId),
			});
			return currentUser;
		},
	},
	Node: {
		__resolveType(parent) {
			return parent.__typename;
		},
	},
	User: {
		id: (parent) => toGlobalId("User", parent.id),
		mailboxes: async (parent, _, { db }) => {
			const mailboxes = await db.query.mailboxTable.findMany({
				where: (t, { eq }) => eq(t.userId, parent.id),
			});
			return mailboxes;
		},
	},
	Mailbox: {
		id: (parent) => toGlobalId("Mailbox", parent.id),
	},
	Thread: {
		id: (parent) => toGlobalId("Thread", parent.id),
	},
	Message: {
		id: (parent) => toGlobalId("Message", parent.id),
	},
};
