import { createGraphQLError, YogaInitialContext } from "graphql-yoga";

import { DBInstance, getDB } from "$lib/db";
import { getBearer, getViewerInfo } from "$lib/hono-apps/authentication";
import { pubsub } from "./pubsub";

import { YogaServerContext } from "./types";

const UNAUTHORIZED = createGraphQLError("UNAUTHORIZED");

export async function context(
	event: YogaInitialContext & YogaServerContext
): Promise<{
	db: DBInstance;
	viewer: NonNullable<Awaited<ReturnType<typeof getViewerInfo>>>;
	pubsub: typeof pubsub;
	env: CloudflareBindings;
	executionCtx: YogaServerContext["executionCtx"];
}> {
	const db = getDB(event.env);

	const isIntrospection =
		event.params.operationName === "IntrospectionQuery" || event.params.query?.includes("__schema");
	if (isIntrospection) return {} as unknown as Context;

	const bearer = getBearer(event.request);
	if (!bearer) throw UNAUTHORIZED;

	const viewer = await getViewerInfo(event.env, db, bearer);
	if (!viewer) throw UNAUTHORIZED;

	return { db, viewer, pubsub, env: event.env, executionCtx: event.executionCtx };
}

export type Context = Awaited<ReturnType<typeof context>>;
