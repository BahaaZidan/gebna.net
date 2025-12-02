import { createSchema, createYoga } from "graphql-yoga";

import { context } from "./context";
import { resolvers } from "./resolvers";
import { YogaServerContext } from "./types";

const schemaFiles = import.meta.glob("$lib/graphql/schema.graphql", {
	query: "?raw",
	import: "default",
	eager: true,
});
const typeDefs = [Object.values(schemaFiles)[0] as string];

export const graphqlRequestHandler = createYoga<YogaServerContext>({
	schema: createSchema({ typeDefs, resolvers }),
	graphqlEndpoint: "/graphql",
	fetchAPI: {
		fetch: globalThis.fetch,
		Request,
		Response,
		Headers,
	},
	context,
});
