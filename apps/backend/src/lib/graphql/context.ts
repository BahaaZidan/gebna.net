import { YogaInitialContext } from "graphql-yoga";

import { getDB } from "$lib/db";
import { getCurrentSession } from "$lib/hono-apps/authentication";

import { YogaServerContext } from "./types";

export async function context(event: YogaInitialContext & YogaServerContext) {
	const db = getDB(event.env);
	if (event.env.FORCED_USER_ID)
		return {
			...event,
			db,
			session: { userId: event.env.FORCED_USER_ID, sessionId: "" },
		};

	const getBearer = () => {
		const header =
			event.request.headers.get("authorization") || event.request.headers.get("Authorization");
		if (!header || !header.toLowerCase().startsWith("bearer ")) return null;
		return header.slice(7).trim();
	};

	const session = await getCurrentSession(event.env, db, getBearer());
	return { ...event, db, session };
}

export type Context = Awaited<ReturnType<typeof context>>;
