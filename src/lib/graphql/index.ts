import { initContextCache } from "@pothos/core";
import { env } from "cloudflare:workers";
import { createGraphQLError, createYoga } from "graphql-yoga";

import type { Viewer } from "#/lib/auth/viewer";
import { db } from "#/lib/db/client";

import { executableSchema } from "./schema/index.js";
import type { GraphQLResolverContext } from "./types.js";

export { executableSchema } from "./schema/index.js";

export * from "./types.js";

const ENABLE_INTROSPECTION = env.DEVELOPMENT === "true";

type GraphQLRequestContext = {
	viewer?: Viewer;
};

const yoga = createYoga<
	GraphQLRequestContext,
	GraphQLResolverContext | Record<string, never>
>({
	schema: executableSchema,
	graphiql: ENABLE_INTROSPECTION,
	fetchAPI: {
		Request,
		Response,
		Headers,
		ReadableStream,
		FormData,
	},
	graphqlEndpoint: "/api/graphql",
	context: async ({ viewer, params }) => {
		const isIntrospection =
			params.operationName === "IntrospectionQuery" ||
			params.query?.includes("__schema");
		if (ENABLE_INTROSPECTION && !viewer && isIntrospection) {
			return {} satisfies Record<string, never>;
		}

		if (!viewer) {
			throw createGraphQLError("UNAUTHORIZED", {
				extensions: {
					http: { status: 401 },
				},
			});
		}

		return {
			...initContextCache(),
			db,
			viewer,
		} satisfies GraphQLResolverContext;
	},
});

export function handleGraphQLRequest(request: Request, viewer?: Viewer) {
	return yoga.handle(request, { viewer });
}
