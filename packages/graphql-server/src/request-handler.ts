import type { Session } from "@gebna/auth/server";
import type { DBInstance } from "@gebna/db";
import { createYoga as createBaseYoga, createGraphQLError } from "graphql-yoga";

import { executableSchema } from "./schema/index.js";
import { GraphQLResolverContext } from "./types.js";

export function createYoga({ db, viewer }: { db: DBInstance; viewer?: Session["user"] | null }) {
	return createBaseYoga({
		schema: executableSchema,
		context: async () => {
			if (!viewer) throw createGraphQLError("UNAUTHORIZED");

			return {
				db,
				viewer,
			} satisfies GraphQLResolverContext;
		},
	});
}
