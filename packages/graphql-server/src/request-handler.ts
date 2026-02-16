import type { Session } from "@gebna/auth/server";
import type { DBInstance } from "@gebna/db";
import { createYoga as createBaseYoga, createGraphQLError } from "graphql-yoga";

import { executableSchema } from "./schema/index.js";
import { GraphQLResolverContext } from "./types.js";

export function createYoga<CTX extends Record<string, any>>({
	db,
	viewer,
	introspection,
}: {
	db: DBInstance;
	viewer?: Session["user"] | null;
	introspection: boolean;
}) {
	return createBaseYoga<CTX>({
		schema: executableSchema,
		graphiql: introspection,
		fetchAPI: { Response },
		graphqlEndpoint: "/api/graphql",
		context: async (initialContext) => {
			const isIntrospection =
				initialContext.params.operationName === "IntrospectionQuery" ||
				initialContext.params.query?.includes("__schema");
			if (introspection && !viewer && isIntrospection) return {};

			if (!viewer) throw createGraphQLError("UNAUTHORIZED");

			return {
				db,
				viewer,
			} satisfies GraphQLResolverContext;
		},
	});
}
