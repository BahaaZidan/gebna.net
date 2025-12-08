import { YogaInitialContext } from "graphql-yoga";

import { getDB } from "$lib/db";
import { getCurrentSession } from "$lib/hono-apps/authentication";

import { YogaServerContext } from "./types";

export async function context(event: YogaInitialContext & YogaServerContext) {
	const db = getDB(event.env);
	if (event.env.FORCED_USER_ID)
		return { ...event, db, session: { userId: event.env.FORCED_USER_ID, sessionId: "" } };

	const session = await getCurrentSession(event.env, db, event.request);
	return { ...event, db, session };
}

export type Context = Awaited<ReturnType<typeof context>>;
