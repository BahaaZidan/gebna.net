import type { Session } from "@gebna/auth/server";
import type { DBInstance } from "@gebna/db";
import { initContextCache } from "@pothos/core";
import { createYoga as createBaseYoga, createGraphQLError } from "graphql-yoga";

import { executableSchema } from "./schema/index.js";
import type { GraphQLResolverContext, PropsToNullable, Simplify } from "./types.js";

export function createYoga<CTX extends Record<string, any>>({
	db,
	viewer,
	introspection,
}: {
	db: DBInstance;
	viewer?: Simplify<PropsToNullable<Session["user"]>>;
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
				...initContextCache(),
				db,
				viewer,
			} satisfies GraphQLResolverContext;
		},
	});
}
