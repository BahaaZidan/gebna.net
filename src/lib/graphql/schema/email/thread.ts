import { and, eq } from "drizzle-orm";

import { dbSchema } from "#/lib/db";

import { builder } from "../builder";

export const EmailThreadRef = builder.drizzleNode("emailThreads", {
	name: "EmailThread",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: { ownerId: true },
	},
	authScopes: (c) => ({ ownedByViewer: c.ownerId }),
	fields: (t) => ({
		title: t.exposeString("title"),
		avatar: t.exposeString("uploadedAvatar"),
		participants: t.relation("participants", {
			nullable: false,
		}),
		lastMessage: t.relation("lastMessage", {
			nullable: false,
		}),
		messages: t.relatedConnection("messages", {
			nullable: false,
			edgesNullable: false,
			nodeNullable: false,
			query: () => ({
				orderBy: {
					createdAt: "asc",
				},
			}),
		}),
		unseenCount: t.exposeInt("unseenCount", { nullable: false }),
	}),
});

builder.mutationFields((t) => ({
	seeEmailThread: t.drizzleField({
		type: EmailThreadRef,
		args: {
			id: t.arg.globalID({ required: true }),
		},
		resolve: async (_query, _parent, args, ctx) => {
			return await ctx.db.transaction(async (tx) => {
				const [thread] = await tx
					.update(dbSchema.emailThreads)
					.set({ unseenCount: 0 })
					.where(
						and(
							eq(dbSchema.emailThreads.ownerId, ctx.viewer.id),
							eq(dbSchema.emailThreads.id, args.id.id),
						),
					)
					.returning();
				if (!thread) return;
				await tx
					.update(dbSchema.emailMessages)
					.set({ unseen: false })
					.where(eq(dbSchema.emailMessages.threadId, thread.id));
				return thread;
			});
		},
	}),
	deleteEmailThread: t.field({
		type: "Boolean",
		nullable: false,
		args: {
			id: t.arg.globalID({ required: true }),
		},
		resolve: async (_parent, args, ctx) => {
			const [thread] = await ctx.db
				.delete(dbSchema.emailThreads)
				.where(
					and(
						eq(dbSchema.emailThreads.ownerId, ctx.viewer.id),
						eq(dbSchema.emailThreads.id, args.id.id),
					),
				)
				.returning({ id: dbSchema.emailThreads.id });

			return !!thread;
		},
	}),
}));
