import SchemaBuilder from "@pothos/core";

import type { GraphQLResolverContext } from "../types.js";

const builder = new SchemaBuilder<{ Context: GraphQLResolverContext }>({});

builder.queryType({
	fields: (t) => ({
		hello: t.string({
			args: {
				name: t.arg.string(),
			},
			resolve: (parent, { name }) => `hello, ${name || "World"}`,
		}),
		dasdas: t.string({
			args: {
				name: t.arg.string(),
			},
			resolve: (parent, { name }) => `hello, ${name || "World"}`,
		}),
	}),
});

export const executableSchema = builder.toSchema();

export default executableSchema;
