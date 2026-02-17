import { getTableConfig, relations } from "@gebna/db";
import SchemaBuilder from "@pothos/core";
import DrizzlePlugin from "@pothos/plugin-drizzle";
import RelayPlugin from "@pothos/plugin-relay";
import WithInputPlugin from "@pothos/plugin-with-input";

import type { GraphQLResolverContext } from "../types.js";

export interface PothosTypes {
	DrizzleRelations: typeof relations;
	Context: GraphQLResolverContext;
}

const builder = new SchemaBuilder<PothosTypes>({
	plugins: [RelayPlugin, WithInputPlugin, DrizzlePlugin],
	drizzle: {
		client: (ctx) => ctx.db,
		getTableConfig,
		relations,
	},
});

const IdentityRef = builder.drizzleObject("identities", {
	name: "Identity",
	select: {
		columns: {},
	},
	fields: (t) => ({
		id: t.exposeID("id", { nullable: false }),
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
	}),
});

const ViewerRef = builder.drizzleObject("users", {
	name: "Viewer",
	select: {
		columns: {},
	},
	fields: (t) => ({
		id: t.exposeID("id", { nullable: false }),
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
