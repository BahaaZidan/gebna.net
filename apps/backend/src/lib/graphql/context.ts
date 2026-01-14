import { createGraphQLError, YogaInitialContext } from "graphql-yoga";

import { DBInstance, getDB } from "$lib/db";
import { getBearer, getViewerInfo } from "$lib/hono-apps/authentication";

import { YogaServerContext } from "./types";

const UNAUTHORIZED = createGraphQLError("UNAUTHORIZED");

export async function context(
	event: YogaInitialContext & YogaServerContext
): Promise<{ db: DBInstance; viewer: NonNullable<Awaited<ReturnType<typeof getViewerInfo>>> }> {
	const db = getDB(event.env);

	const isIntrospection =
		event.params.operationName === "IntrospectionQuery" || event.params.query?.includes("__schema");
	if (isIntrospection) return {} as unknown as Context;

	const bearer = getBearer(event.request);
	if (!bearer) throw UNAUTHORIZED;

	const viewer = await getViewerInfo(event.env, db, bearer);
	if (!viewer) throw UNAUTHORIZED;

	return { db, viewer };
}

export type Context = Awaited<ReturnType<typeof context>>;
