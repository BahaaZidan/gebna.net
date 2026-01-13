import { createGraphQLError, YogaInitialContext } from "graphql-yoga";

import { getDB } from "$lib/db";
import { getBearer, getViewerInfo } from "$lib/hono-apps/authentication";

import { YogaServerContext } from "./types";

const UNAUTHORIZED = createGraphQLError("UNAUTHORIZED");

export async function context(event: YogaInitialContext & YogaServerContext) {
	const db = getDB(event.env);

	const bearer = getBearer(event.request);
	if (!bearer) throw UNAUTHORIZED;

	const viewer = await getViewerInfo(event.env, db, bearer);
	if (!viewer) throw UNAUTHORIZED;

	return { ...event, db, viewer };
}

export type Context = Awaited<ReturnType<typeof context>>;
