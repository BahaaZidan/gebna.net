import { getTableConfig, relations } from "@gebna/db";
import {
	ConversationKind,
	conversationParticipants,
	Mailbox,
	ParticipantRole,
	ParticipantState,
	Transport,
} from "@gebna/db/schema";
import SchemaBuilder from "@pothos/core";
import DrizzlePlugin from "@pothos/plugin-drizzle";
import RelayPlugin from "@pothos/plugin-relay";
import ScopeAuthPlugin from "@pothos/plugin-scope-auth";
import WithInputPlugin from "@pothos/plugin-with-input";
import { DateTimeResolver } from "graphql-scalars";

import type { GraphQLResolverContext } from "../types.js";

type ViewerActiveParticipations = Array<
	Pick<typeof conversationParticipants.$inferSelect, "ownerId" | "state">
>;
const builder = new SchemaBuilder<{
	DrizzleRelations: typeof relations;
	Context: GraphQLResolverContext;
	Scalars: {
		DateTime: {
			Input: Date;
			Output: Date;
		};
	};
	AuthScopes: {
		ownedByViewer: string;
		viewerActiveParticipant: ViewerActiveParticipations;
	};
}>({
	plugins: [RelayPlugin, ScopeAuthPlugin, WithInputPlugin, DrizzlePlugin],
	drizzle: {
		client: (ctx) => ctx.db,
		getTableConfig,
		relations,
	},
	scopeAuth: {
		authScopes: async (context) => {
			return {
				ownedByViewer: (userId) => userId === context.viewer.id,
				viewerActiveParticipant: (
					participations: Array<
						Pick<typeof conversationParticipants.$inferSelect, "ownerId" | "state">
					>
				) =>
					participations
						.filter((p) => p.state === "ACTIVE" && !!p.ownerId)
						.map((p) => p.ownerId)
						.includes(context.viewer.id),
			};
		},
	},
});

builder.addScalarType("DateTime", DateTimeResolver);

const ConversationViewerStateMailboxEnum = builder.enumType("ConversationViewerStateMailbox", {
	values: Mailbox,
});
const ConversationViewerStateRef = builder.drizzleObject("conversationViewerStates", {
	name: "ConversationViewerState",
	select: {
		columns: {
			id: true,
		},
	},
	fields: (t) => ({
		id: t.globalID({
			nullable: false,
			resolve: (parent) => {
				return { id: parent.id, type: "ConversationViewerState" };
			},
		}),
		unseenCount: t.exposeInt("unseenCount", { nullable: false }),
		mailbox: t.expose("mailbox", {
			type: ConversationViewerStateMailboxEnum,
			nullable: false,
		}),
	}),
});

const MessageDeliveryTransportEnum = builder.enumType("MessageDeliveryTransport", {
	values: Transport,
});
const MessageDeliveryRef = builder.drizzleObject("messageDeliveries", {
	name: "MessageDelivery",
	select: {
		columns: { id: true },
	},
	fields: (t) => ({
		id: t.globalID({
			nullable: false,
			resolve: (parent) => {
				return { id: parent.id, type: "MessageDelivery" };
			},
		}),
		recipient: t.relation("recipientIdentity", { nullable: false }),
		transport: t.expose("transport", {
			type: MessageDeliveryTransportEnum,
			nullable: false,
		}),
	}),
});

const MessageRef = builder.drizzleNode("messages", {
	name: "Message",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: {},
		with: {
			conversation: {
				columns: {},
				with: {
					participants: {
						columns: {
							ownerId: true,
							state: true,
						},
					},
				},
			},
		},
	},
	authScopes: (m) => ({ viewerActiveParticipant: m.conversation?.participants }),
	fields: (t) => ({
		conversation: t.relation("conversation", { nullable: false }),
		sender: t.relation("senderIdentity", { nullable: false }),
		createdAt: t.expose("createdAt", {
			type: "DateTime",
			nullable: false,
		}),
		deliveries: t.relation("deliveries", { nullable: false }),
		snippet: t.exposeString("bodyPlainTextSnippet"),
		plainText: t.exposeString("bodyPlainText"),
		hasRawHTML: t.exposeBoolean("hasBodyRawHTML"),
		rawHTML: t.exposeString("bodyRawHTML"),
		html: t.exposeString("bodyHTMLFromMD"),
	}),
});

const ConversationParticipationRoleEnum = builder.enumType("ConversationParticipationRole", {
	values: ParticipantRole,
});
const ConversationParticipationStateEnum = builder.enumType("ConversationParticipationState", {
	values: ParticipantState,
});
const ConversationParticipationRef = builder.drizzleObject("conversationParticipants", {
	name: "ConversationParticipation",
	select: {
		columns: { id: true },
	},
	fields: (t) => ({
		id: t.globalID({
			nullable: false,
			resolve: (parent) => {
				return { id: parent.id, type: "ConversationParticipation" };
			},
		}),
		conversation: t.relation("conversation", { nullable: false }),
		identity: t.relation("identity", { nullable: false }),
		joinedAt: t.expose("joinedAt", {
			type: "DateTime",
			nullable: false,
		}),
		role: t.expose("role", {
			type: ConversationParticipationRoleEnum,
			nullable: false,
		}),
		state: t.expose("state", {
			type: ConversationParticipationStateEnum,
			nullable: false,
		}),
	}),
});

const ConversationKindEnum = builder.enumType("ConversationKind", { values: ConversationKind });
const ConversationRef = builder.drizzleNode("conversations", {
	name: "Conversation",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: {},
		with: {
			participants: {
				columns: {
					ownerId: true,
					state: true,
				},
			},
		},
	},
	authScopes: (c) => ({ viewerActiveParticipant: c.participants }),
	fields: (t) => ({
		title: t.exposeString("title"),
		kind: t.expose("kind", {
			type: ConversationKindEnum,
			nullable: false,
		}),
		avatar: t.exposeString("uploadedAvatar"),
		participations: t.relation("participants", {
			nullable: false,
			description: "A list of all past and present participations in this conversation.",
		}),
		lastMessage: t.relation("lastMessage"),
		messages: t.relatedConnection("messages", { nullable: false }),
		viewerState: t.relation("viewerStates", {
			query: (args, context, pathInfo) => ({
				where: {
					ownerId: context.viewer.id,
				},
				limit: 1,
			}),
		}),
	}),
});

const IdentityRelationship = builder.drizzleObject("identityRelationships", {
	name: "IdentityRelationship",
	select: {
		columns: { id: true },
	},
	fields: (t) => ({
		id: t.globalID({
			nullable: false,
			resolve: (parent) => {
				return { id: parent.id, type: "IdentityRelationship" };
			},
		}),
		givenName: t.exposeString("givenName"),
		avatar: t.exposeString("uploadedAvatar"),
	}),
});

const IdentityRef = builder.drizzleObject("identities", {
	name: "Identity",
	select: {
		columns: { id: true },
	},
	fields: (t) => ({
		id: t.globalID({
			nullable: false,
			resolve: (parent) => {
				return { id: parent.id, type: "Identity" };
			},
		}),
		name: t.exposeString("name"),
		avatar: t.string({
			nullable: false,
			select: {
				columns: {
					avatarPlaceholder: true,
					inferredAvatar: true,
				},
			},
			resolve: (user) => user.inferredAvatar || user.avatarPlaceholder,
		}),
		address: t.exposeString("address", { nullable: false }),
		participations: t.relatedConnection("participations", {
			nullable: false,
			description: "The conversation participations done by this identity",
		}),
		viewerRelationsShip: t.relation("relationships", {
			query: (args, context, pathInfo) => ({
				where: {
					ownerId: context.viewer.id,
				},
				limit: 1,
			}),
		}),
	}),
});

const ViewerRef = builder.drizzleNode("users", {
	name: "Viewer",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: {
			id: true,
		},
	},
	authScopes: (v) => ({ ownedByViewer: v.id }),
	fields: (t) => ({
		name: t.exposeString("name", { nullable: false }),
		avatar: t.string({
			nullable: false,
			select: {
				columns: {
					avatarPlaceholder: true,
					uploadedAvatar: true,
				},
			},
			resolve: (user) => user.uploadedAvatar || user.avatarPlaceholder,
		}),
		identity: t.relation("identity", {
			nullable: false,
		}),
	}),
});

builder.queryType({
	fields: (t) => ({
		viewer: t.drizzleField({
			type: ViewerRef,
			resolve(query, parent, args, ctx, info) {
				return ctx.db.query.users.findFirst(query({ where: { id: ctx.viewer.id } }));
			},
		}),
	}),
});

export const executableSchema = builder.toSchema();

export default executableSchema;
