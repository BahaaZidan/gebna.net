import type { IdentityRelationshipSelectModel } from "@gebna/db";
import {
	conversationParticipantTable,
	conversationViewerStateTable,
	Mailbox,
} from "@gebna/db/schema";
import { v } from "@gebna/vali";
import { error } from "@sveltejs/kit";
import { sql } from "drizzle-orm";

import { getRequestEvent, query } from "$app/server";

import { db } from "./db.ts";

export const getConversation = query(v.pipe(v.string(), v.ulid()), async (conversationId) => {
	const { locals } = getRequestEvent();
	const viewer = locals.user;
	if (!viewer) error(400, "NOT_AUTHORIZED");

	const conversation = await db.query.conversationTable.findFirst({
		with: {
			participants: {
				with: {
					identity: {
						with: {
							relations: {
								where: (t, { eq }) => eq(t.ownerId, viewer.id),
							},
						},
					},
				},
			},
			messages: {
				limit: 20,
				columns: {
					id: true,
					bodyMD: true,
					createdAt: true,
					hasHTML: true,
				},
				with: {
					senderIdentity: {
						columns: {
							id: true,
							address: true,
							kind: true,
							avatarPlaceholder: true,
							inferredAvatar: true,
							name: true,
						},
					},
				},
			},
		},
		where: (t, { eq }) => eq(t.id, conversationId),
	});
	if (!conversation || conversation.participants.findIndex((p) => p.ownerId === viewer.id) === -1)
		return null;

	return conversation;
});

export const getConversations = query(
	v.object({
		first: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(25)), 20),
		after: v.optional(v.pipe(v.string(), v.ulid())),
		mailbox: v.optional(v.picklist(Mailbox), "IMPORTANT"),
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		const viewer = locals.user;
		if (!viewer) error(400, "NOT_AUTHORIZED");

		const participations = (await db.query.conversationParticipantTable.findMany({
			with: {
				conversation: {
					with: {
						viewerStates: {
							columns: {
								id: true,
								unreadCount: true,
							},
							limit: 1,
							where: (t, { eq }) => eq(t.ownerId, viewer.id),
						},
						lastMessage: {
							columns: {
								id: true,
								bodySnippet: true,
								createdAt: true,
							},
						},
						participants: {
							columns: {
								id: true,
								identityId: true,
							},
							with: {
								identity: {
									with: {
										relations: {
											where: (t, { eq }) => eq(t.ownerId, viewer.id),
										},
									},
								},
							},
						},
					},
				},
			},
			limit: input.first + 1,
			where: (t, { and, eq, exists, lt }) =>
				and(
					eq(t.ownerId, viewer.id),
					exists(
						db
							.select({ one: sql`1` })
							.from(conversationViewerStateTable)
							.where(
								and(
									eq(conversationViewerStateTable.conversationId, t.conversationId),
									eq(conversationViewerStateTable.ownerId, viewer.id),
									eq(conversationViewerStateTable.mailbox, input.mailbox)
								)
							)
					),
					input.after ? lt(t.conversationId, input.after) : undefined
				),
			orderBy: (t, { desc }) => desc(t.joinedAt),
		})) satisfies Awaited<
			ReturnType<(typeof db)["query"]["conversationParticipantTable"]["findMany"]>
		>;

		const conversations = participations.slice(0, input.first).map((p) => p.conversation);
		const hasNextPage = participations.length > conversations.length;

		return {
			data: { conversations },
			pageInfo: {
				hasNextPage,
				endCursor: hasNextPage ? conversations[conversations.length - 1] : null,
			},
		};
	}
);

export const getMessageHTML = query(v.pipe(v.string(), v.ulid()), async (messageId) => {
	const { locals } = getRequestEvent();
	const viewer = locals.user;
	if (!viewer) error(400, "NOT_AUTHORIZED");

	const message = await db.query.messageTable.findFirst({
		columns: {
			id: true,
			bodyHTML: true,
		},
		with: {
			conversation: {
				with: {
					participants: {
						limit: 1,
						columns: {
							ownerId: true,
						},
						where: (t, { eq }) => eq(t.ownerId, viewer.id),
					},
				},
			},
		},
		where: (t, { eq }) => eq(t.id, messageId),
	});

	if (
		!message ||
		message.conversation.participants.findIndex((p) => p.ownerId === viewer.id) === -1
	)
		return null;

	return message;
});
