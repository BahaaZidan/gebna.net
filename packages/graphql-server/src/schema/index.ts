import { getTableConfig, relations } from "@gebna/db";
import { ConversationKind, ParticipantRole, ParticipantState, Transport } from "@gebna/db/schema";
import SchemaBuilder from "@pothos/core";
import DrizzlePlugin from "@pothos/plugin-drizzle";
import RelayPlugin from "@pothos/plugin-relay";
import WithInputPlugin from "@pothos/plugin-with-input";
import { DateTimeResolver } from "graphql-scalars";

import type { GraphQLResolverContext } from "../types.js";

export interface PothosTypes {
	DrizzleRelations: typeof relations;
	Context: GraphQLResolverContext;
	Scalars: {
		DateTime: {
			Input: Date;
			Output: Date;
		};
	};
}

const builder = new SchemaBuilder<PothosTypes>({
	plugins: [RelayPlugin, WithInputPlugin, DrizzlePlugin],
	drizzle: {
		client: (ctx) => ctx.db,
		getTableConfig,
		relations,
	},
});
builder.addScalarType("DateTime", DateTimeResolver);

const MessageDeliveryTransportEnum = builder.enumType("MessageDeliveryTransport", {
	values: Transport,
});
const MessageDeliveryRef = builder.drizzleNode("messageDeliveries", {
	name: "MessageDelivery",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: {},
	},
	fields: (t) => ({
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
	},
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
const ConversationParticipationRef = builder.drizzleNode("conversationParticipants", {
	name: "ConversationParticipation",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: {},
	},
	fields: (t) => ({
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
	},
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
	}),
});

const IdentityRef = builder.drizzleNode("identities", {
	name: "Identity",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: {},
	},
	fields: (t) => ({
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
	}),
});

const ViewerRef = builder.drizzleNode("users", {
	name: "Viewer",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: {},
	},
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
