import { getTableConfig, relations } from "@gebna/db";
import { EmailConversationKind } from "@gebna/db/schema";
import SchemaBuilder from "@pothos/core";
import DrizzlePlugin from "@pothos/plugin-drizzle";
import RelayPlugin from "@pothos/plugin-relay";
import ScopeAuthPlugin from "@pothos/plugin-scope-auth";
import WithInputPlugin from "@pothos/plugin-with-input";
import { DateTimeResolver } from "graphql-scalars";

import type { GraphQLResolverContext } from "../types.js";

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
			};
		},
	},
});

builder.addScalarType("DateTime", DateTimeResolver);

const EmailAddressRefRef = builder.drizzleNode("emailAddressRefs", {
	name: "EmailAddressRef",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: {
			ownerId: true,
			givenName: true,
			givenAvatar: true,
		},
		with: { address_: true },
	},
	authScopes: (m) => ({ ownedByViewer: m.ownerId }),
	fields: (t) => ({
		address: t.exposeString("address", { nullable: false }),
		name: t.string({
			nullable: false,
			resolve: (ref) => ref.givenName || ref.address_?.name || ref.address_?.address!,
		}),
		avatar: t.string({
			nullable: false,
			resolve: (ref) =>
				ref.givenAvatar || ref.address_?.inferredAvatar || ref.address_?.avatarPlaceholder!,
		}),
		isSelf: t.boolean({
			nullable: false,
			resolve: (ref, args, ctx) => ctx.viewer.email === ref.address_?.address,
		}),
	}),
});

const EmailMessageRef = builder.drizzleNode("emailMessages", {
	name: "EmailMessage",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: {
			ownerId: true,
		},
	},
	authScopes: (m) => ({ ownedByViewer: m.ownerId }),
	fields: (t) => ({
		from: t.relation("fromRef", { nullable: false }),
		to: t.relation("toRef", { nullable: false }),
		createdAt: t.expose("createdAt", {
			type: "DateTime",
			nullable: false,
		}),
		snippet: t.exposeString("bodySnippet"),
		html: t.exposeString("bodyHTML"),
	}),
});

const EmailConversationParticipationRef = builder.drizzleObject("emailConversationParticipants", {
	name: "EmailConversationParticipation",
	select: {
		columns: {},
	},
	fields: (t) => ({
		conversation: t.relation("conversation", { nullable: false }),
		emailAddressRef: t.relation("emailAddressRef", { nullable: false }),
	}),
});

const EmailConversationKindEnum = builder.enumType("EmailConversationKind", {
	values: EmailConversationKind,
});
const EmailConversationRef = builder.drizzleNode("emailConversations", {
	name: "EmailConversation",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: { ownerId: true },
	},
	authScopes: (c) => ({ ownedByViewer: c.ownerId }),
	fields: (t) => ({
		title: t.exposeString("title"),
		kind: t.expose("kind", {
			type: EmailConversationKindEnum,
			nullable: false,
		}),
		avatar: t.exposeString("uploadedAvatar"),
		participations: t.relation("participants", {
			nullable: false,
		}),
		lastMessage: t.relation("lastMessage", { nullable: false }),
		messages: t.relatedConnection("messages", {
			nullable: false,
			edgesNullable: false,
			nodeNullable: false,
		}),
		unseenCount: t.exposeInt("unseenCount", { nullable: false }),
	}),
});

const ViewerRef = builder.drizzleObject("users", {
	name: "Viewer",
	select: {
		columns: {
			id: true,
			avatarPlaceholder: true,
			uploadedAvatar: true,
		},
	},
	fields: (t) => ({
		id: t.globalID({
			nullable: false,
			resolve: (parent) => {
				return { id: parent.id, type: "Viewer" };
			},
		}),
		name: t.exposeString("name", { nullable: false }),
		avatar: t.string({
			nullable: false,
			resolve: (user) => user.uploadedAvatar || user.avatarPlaceholder,
		}),
		emailAddress: t.exposeString("email", { nullable: false }),
		emailConversations: t.relatedConnection("emailConversations", {
			nullable: false,
			edgesNullable: false,
			nodeNullable: false,
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
