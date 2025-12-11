import { and, count, eq, gt } from "drizzle-orm";
import { DateTimeResolver, URLResolver } from "graphql-scalars";

import { threadTable } from "$lib/db/schema";

import type { Resolvers } from "./resolvers.types";
import { fromGlobalId, toGlobalId } from "./utils";

export const resolvers: Resolvers = {
	DateTime: DateTimeResolver,
	URL: URLResolver,
	Query: {
		viewer: async (_parent, _args, { session, db }) => {
			if (!session) return null;
			const currentUser = db.query.userTable.findFirst({
				where: (t, { eq }) => eq(t.id, session.userId),
			});
			return currentUser;
		},
		node: async (_parent, args, { session, db }) => {
			const { type, id } = fromGlobalId(args.id);
			switch (type) {
				case "Thread": {
					const thread =
						session &&
						(await db.query.threadTable.findFirst({
							where: (t, { eq, and }) => and(eq(t.id, id), eq(t.recipientId, session.userId)),
						}));
					return thread ? { ...thread, __typename: "Thread" } : null;
				}
				default:
					return null;
			}
		},
	},
	Node: {
		__resolveType(parent) {
			return parent.__typename;
		},
	},
	User: {
		id: (parent) => toGlobalId("User", parent.id),
		mailbox: async (parent, args, { db }) => {
			const mailbox = await db.query.mailboxTable.findFirst({
				where: (t, { eq, and }) => and(eq(t.userId, parent.id), eq(t.type, args.type)),
			});
			return mailbox;
		},
	},
	Mailbox: {
		id: (parent) => toGlobalId("Mailbox", parent.id),
		threads: async (parent, args, { db }) => {
			const pageSize = args.first || 30;
			const cursor = args.after;
			const threadsPlusOne = await db.query.threadTable.findMany({
				where: (t, { eq, and, lt, gt }) =>
					and(
						eq(t.mailboxId, parent.id),
						cursor ? lt(t.id, fromGlobalId(cursor).id) : undefined,
						args.filter
							? args.filter.unread
								? gt(t.unreadCount, 0)
								: eq(t.unreadCount, 0)
							: undefined
					),
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
		unreadThreadsCount: async (parent, _, { db }) => {
			const [{ unreadThreadsCount }] = await db
				.select({ unreadThreadsCount: count() })
				.from(threadTable)
				.where(and(eq(threadTable.mailboxId, parent.id), gt(threadTable.unreadCount, 0)));
			return unreadThreadsCount;
		},
	},
	Thread: {
		id: (parent) => toGlobalId("Thread", parent.id),
		unreadMessagesCount: (parent) => parent.unreadCount,
		messages: async (parent, _, { db }) => {
			const messages = await db.query.messageTable.findMany({
				where: (t, { eq }) => eq(t.threadId, parent.id),
				orderBy: (t, { desc }) => desc(t.createdAt),
			});
			return messages;
		},
	},
	Message: {
		id: (parent) => toGlobalId("Message", parent.id),
		recievedAt: (parent) => parent.createdAt,
		attachments: async (parent, _, { db }) => {
			const attachments = await db.query.attachmentTable.findMany({
				where: (t, { eq }) => eq(t.messageId, parent.id),
			});
			return attachments;
		},
	},
};
