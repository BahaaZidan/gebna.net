import {
	createDefaultPublishableContext,
	createWsConnectionPoolClass,
	DefaultPublishableContext,
	handleSubscriptions,
} from "graphql-workers-subscriptions";
import { createGraphQLError, createYoga, type YogaInitialContext } from "graphql-yoga";
import { Hono } from "hono";
import { logger } from "hono/logger";

import { DBInstance, getDB } from "$lib/db";
import { executableSchema } from "$lib/graphql/executable-schema";
import {
	authenticationApp,
	getBearer,
	getViewerInfo,
	type ViewerInfo,
} from "$lib/hono-apps/authentication";
import { seedingApp } from "$lib/hono-apps/seeding";

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.use(logger());

app.route("/auth", authenticationApp);
app.route("/seed", seedingApp);

type GraphQLServerContext = DefaultPublishableContext<
	CloudflareBindings,
	ExecutionContext<unknown> | undefined
>;

const UNAUTHORIZED = createGraphQLError("UNAUTHORIZED");

async function context(
	initialContext: YogaInitialContext & GraphQLServerContext
): Promise<GraphQLUserContext> {
	const db = getDB(initialContext.env);

	const isIntrospection =
		initialContext.params.operationName === "IntrospectionQuery" ||
		initialContext.params.query?.includes("__schema");
	if (isIntrospection) return {} as GraphQLUserContext;

	const bearer = getBearer(initialContext.request);
	if (!bearer) throw UNAUTHORIZED;

	const viewer = await getViewerInfo(initialContext.env, db, bearer);
	if (!viewer) throw UNAUTHORIZED;

	return {
		db,
		viewer,
	};
}

type GraphQLUserContext = {
	db: DBInstance;
	viewer: ViewerInfo;
};
export type GraphQLResolverContext = GraphQLServerContext & GraphQLUserContext;

const settings = {
	schema: executableSchema,
	wsConnectionPool: (env: CloudflareBindings): DurableObjectNamespace =>
		env.WS_CONNECTION_POOL as unknown as DurableObjectNamespace,
	subscriptionsDb: (env: CloudflareBindings) => env.SUBSCRIPTIONS,
};

const yoga = createYoga<GraphQLServerContext, GraphQLUserContext>({
	graphqlEndpoint: "/graphql",
	schema: executableSchema,
	context,
	fetchAPI: {
		fetch: globalThis.fetch,
		Request,
		Response,
		Headers,
	},
	graphiql: {
		subscriptionsProtocol: "WS",
	},
});
app.use("/graphql", async (c) => {
	return yoga.handleRequest(
		c.req.raw,
		createDefaultPublishableContext({
			env: c.env,
			executionCtx: c.executionCtx as ExecutionContext,
			...settings,
		})
	);
});

const baseFetch = app.fetch;

export const fetchHandler = handleSubscriptions({
	fetch: baseFetch,
	...settings,
});
export const WsConnectionPool = createWsConnectionPoolClass(settings);
