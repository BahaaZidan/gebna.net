import { createSchema } from "graphql-yoga";
import { GraphQLResolverContext } from "src/worker-handlers/fetch";

import { resolvers } from "./resolvers";

const schemaFiles = import.meta.glob("../../../../../packages/graphql/schema.graphql", {
	query: "?raw",
	import: "default",
	eager: true,
});
const typeDefs = [Object.values(schemaFiles)[0] as string];

export const executableSchema = createSchema<GraphQLResolverContext>({ typeDefs, resolvers });
