import SchemaBuilder from "@pothos/core";
import DrizzlePlugin from "@pothos/plugin-drizzle";
import RelayPlugin from "@pothos/plugin-relay";
import ScopeAuthPlugin from "@pothos/plugin-scope-auth";
import ValidationPlugin from "@pothos/plugin-validation";
import WithInputPlugin from "@pothos/plugin-with-input";

import { getTableConfig, relations } from "#/lib/db";

import type { GraphQLResolverContext } from "../types.js";

export const builder = new SchemaBuilder<{
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
	plugins: [
		RelayPlugin,
		ScopeAuthPlugin,
		WithInputPlugin,
		DrizzlePlugin,
		ValidationPlugin,
	],
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

builder.queryType({});
builder.mutationType({});
