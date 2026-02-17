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

const ViewerRef = builder.drizzleObject("users", {
	name: "Viewer",
	// select: {

	// 	with: {
	// 		identity: true
	// 	}
	// },
	fields: (t) => ({
		id: t.exposeID("id"),
		name: t.exposeString("name"),
		avatar: t.string({
			resolve: (user) => user.uploadedAvatar || user.avatarPlaceholder,
		}),
	}),
});

builder.queryType({
	fields: (t) => ({
		viewer: t.drizzleField({
			type: ViewerRef,
			resolve(query, parent, args, ctx, info) {
				return ctx.viewer;
			},
		}),
	}),
});

export const executableSchema = builder.toSchema();

export default executableSchema;
