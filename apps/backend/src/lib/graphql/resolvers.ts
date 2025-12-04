import { DateTimeResolver, URLResolver } from "graphql-scalars";

import type { Resolvers } from "./resolvers.types";
import { fromGlobalId, toGlobalId } from "./utils";

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
		threads: async (parent, args, { db }) => {
			const pageSize = args.first || 30;
			const cursor = args.after;
			const threadsPlusOne = await db.query.threadTable.findMany({
				where: (t, { eq, and, lt }) =>
					and(eq(t.mailboxId, parent.id), cursor ? lt(t.id, fromGlobalId(cursor).id) : undefined),
				orderBy: (t, { desc }) => desc(t.lastMessageAt),
				limit: pageSize + 1,
			});
			const threads = threadsPlusOne.slice(0, pageSize);

			return {
				edges: threads.map((node) => ({ node, cursor: toGlobalId("Thread", node.id) })),
				pageInfo: {
					hasNextPage: threadsPlusOne.length > threads.length,
					endCursor: threads.length ? toGlobalId("Thread", threads[threads.length - 1].id) : null,
				},
			};
		},
	},
	Thread: {
		id: (parent) => toGlobalId("Thread", parent.id),
	},
	Message: {
		id: (parent) => toGlobalId("Message", parent.id),
	},
};
