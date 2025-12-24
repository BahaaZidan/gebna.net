import { AwsClient } from "aws4fetch";
import { and, count, eq, gt } from "drizzle-orm";
import { DateTimeResolver, URLResolver } from "graphql-scalars";

import { contactTable, messageTable, threadTable } from "$lib/db/schema";
import { searchMessages as searchMessagesDb } from "$lib/db";

import type { Resolvers } from "./resolvers.types";
import { fromGlobalId, toGlobalId } from "./utils";

export const resolvers: Resolvers = {
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
							where: (t, { eq, and }) => and(eq(t.id, id), eq(t.ownerId, session.userId)),
						}));
					return thread ? { ...thread, __typename: "Thread" } : null;
				}
				case "Contact": {
					const address_user =
						session &&
						(await db.query.contactTable.findFirst({
							where: (t, { eq, and }) => and(eq(t.id, id), eq(t.ownerId, session.userId)),
						}));
					return address_user ? { ...address_user, __typename: "Contact" } : null;
				}
				default:
					return null;
			}
		},
		searchMessages: async (_parent, args, { session, db }) => {
			if (!session) return [];
			const mailboxId = args.mailboxId ? fromGlobalId(args.mailboxId).id : null;

			const results = await searchMessagesDb(db, {
				ownerId: session.userId,
				query: args.query,
				mailboxId,
				limit: args.limit ?? 20,
				offset: args.offset ?? 0,
			});

			return results.map((result) => ({
				threadId: toGlobalId("Thread", result.threadId),
				messageId: toGlobalId("Message", result.messageId),
			}));
		},
	},
	Mutation: {
		assignTargetMailbox: async (_, { input }, { session, db }) => {
			if (!session) return;
			const targetMailbox = await db.query.mailboxTable.findFirst({
				where: (t, { eq, and }) =>
					and(eq(t.userId, session.userId), eq(t.type, input.targetMailboxType)),
			});
			if (!targetMailbox) return;
			return await db.transaction(async (tx) => {
				const [contact] = await tx
					.update(contactTable)
					.set({ targetMailboxId: targetMailbox.id, updatedAt: new Date() })
					.where(
						and(
							eq(contactTable.ownerId, session.userId),
							eq(contactTable.id, fromGlobalId(input.contactID).id)
						)
					)
					.returning();

				// TODO: consider doing this in the background using `executionContext.waitUntil()`.
				await tx
					.update(messageTable)
					.set({ mailboxId: targetMailbox.id })
					.where(
						and(eq(messageTable.ownerId, session.userId), eq(messageTable.from, contact.address))
					);

				await tx
					.update(threadTable)
					.set({ mailboxId: targetMailbox.id })
					.where(
						and(
							eq(threadTable.ownerId, session.userId),
							eq(threadTable.firstMessageFrom, contact.address)
						)
					);

				return contact;
			});
		},
		markThreadSeen: async (_, args, { session, db }) => {
			if (!session?.userId) return;
			return await db.transaction(async (tx) => {
				const [thread] = await tx
					.update(threadTable)
					.set({ unseenCount: 0 })
					.where(
						and(
							eq(threadTable.ownerId, session.userId),
							eq(threadTable.id, fromGlobalId(args.id).id)
						)
					)
					.returning();
				if (!thread) return;
				await tx
					.update(messageTable)
					.set({ unseen: false })
					.where(and(eq(messageTable.threadId, thread.id), eq(messageTable.unseen, true)));

				return thread;
			});
		},
	},
	Node: {
		__resolveType(parent) {
			return parent.__typename;
		},
	},
	DateTime: DateTimeResolver,
	URL: URLResolver,
	User: {
		id: (parent) => toGlobalId("User", parent.id),
		mailbox: async (parent, args, { db }) => {
			const mailbox = await db.query.mailboxTable.findFirst({
				where: (t, { eq, and }) => and(eq(t.userId, parent.id), eq(t.type, args.type)),
			});
			return mailbox;
		},
		avatar: (parent) => parent.avatar || parent.avatarPlaceholder,
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
							? args.filter.unseen
								? gt(t.unseenCount, 0)
								: eq(t.unseenCount, 0)
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
		unseenThreadsCount: async (parent, _, { db }) => {
			if (parent.type !== "important") return 0;
			const [{ unseenThreadsCount }] = await db
				.select({ unseenThreadsCount: count() })
				.from(threadTable)
				.where(and(eq(threadTable.mailboxId, parent.id), gt(threadTable.unseenCount, 0)));
			return unseenThreadsCount;
		},
		assignedContactsCount: async (parent, _, { db }) => {
			const [{ assignedContactsCount }] = await db
				.select({ assignedContactsCount: count() })
				.from(contactTable)
				.where(eq(contactTable.targetMailboxId, parent.id));

			return assignedContactsCount;
		},
		contacts: async (parent, args, { db }) => {
			const pageSize = args.first || 30;
			const cursor = args.after;
			const contactsPlusOne = await db.query.contactTable.findMany({
				where: (t, { eq, and, lt }) =>
					and(
						eq(t.ownerId, parent.userId),
						eq(t.targetMailboxId, parent.id),
						cursor ? lt(t.id, fromGlobalId(cursor).id) : undefined
					),
				orderBy: (t, { desc }) => desc(t.createdAt),
				limit: pageSize + 1,
			});
			const contacts = contactsPlusOne.slice(0, pageSize);

			return {
				edges: contacts.map((node) => ({
					node,
					cursor: toGlobalId("Contact", node.id),
				})),
				pageInfo: {
					hasNextPage: contactsPlusOne.length > contacts.length,
					endCursor: contacts.length
						? toGlobalId("Contact", contacts[contacts.length - 1].id)
						: null,
				},
			};
		},
	},
	Thread: {
		id: (parent) => toGlobalId("Thread", parent.id),
		unseenMessagesCount: (parent) => parent.unseenCount,
		messages: async (parent, _, { db }) => {
			const messages = await db.query.messageTable.findMany({
				where: (t, { eq }) => eq(t.threadId, parent.id),
				orderBy: (t, { desc }) => desc(t.createdAt),
			});
			return messages;
		},
		from: async (parent, _, { db }) => {
			const contact = await db.query.contactTable.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.ownerId, parent.ownerId), eq(t.address, parent.firstMessageFrom)),
			});
			return contact!;
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
		from: async (parent, _, { db }) => {
			const record = await db.query.contactTable.findFirst({
				where: (t, { and, eq }) => and(eq(t.ownerId, parent.ownerId), eq(t.address, parent.from)),
			});
			return record!;
		},
	},
	Contact: {
		id: (parent) => toGlobalId("Contact", parent.id),
		avatar: (parent) => parent.avatar || parent.avatarPlaceholder,
		targetMailbox: async (parent, _, { db }) => {
			const mailbox = await db.query.mailboxTable.findFirst({
				where: (t, { eq }) => eq(t.id, parent.targetMailboxId),
			});
			return mailbox!;
		},
		messages: async (parent, _, { db }) => {
			const messages = await db.query.messageTable.findMany({
				where: (t, { eq }) => eq(t.from, parent.address),
			});
			return messages;
		},
	},
	Attachment: {
		id: (parent) => toGlobalId("Attachment", parent.id),
		url: async (parent, _, { env }) => {
			const R2_URL = `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
			const client = new AwsClient({
				service: "s3",
				region: "auto",
				accessKeyId: env.CF_R2_ACCESS_KEY_ID,
				secretAccessKey: env.CF_R2_SECRET_ACCESS_KEY,
			});

			const url = (
				await client.sign(
					new Request(
						`${R2_URL}/${env.R2_BUCKET_NAME}/${parent.storageKey}?X-Amz-Expires=${3600 * 6}`
					),
					{
						aws: { signQuery: true },
					}
				)
			).url.toString();

			return url;
		},
	},
};
