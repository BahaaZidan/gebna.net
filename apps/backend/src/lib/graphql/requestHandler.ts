import { createSchema, createYoga } from "graphql-yoga";

import { getDB } from "../db";

type YogaServerContext = {
	env: CloudflareBindings;
	executionCtx: ExecutionContext;
};

export const schema = createSchema<YogaServerContext>({
	typeDefs: /* GraphQL */ `
		type Query {
			hello: String
		}
	`,
	resolvers: {
		Query: {
			hello: () => "world",
		},
	},
});

export const graphqlRequestHandler = createYoga<YogaServerContext>({
	schema,
	graphqlEndpoint: "/graphql",
	fetchAPI: {
		fetch: globalThis.fetch,
		Request,
		Response,
		Headers,
	},
	context: (event) => {
		const db = getDB(event.env);
		return { ...event, db };
	},
});
