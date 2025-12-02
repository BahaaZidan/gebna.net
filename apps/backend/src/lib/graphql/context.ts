import { YogaInitialContext } from "graphql-yoga";

import { getDB } from "$lib/db";

import { YogaServerContext } from "./types";

export function context(event: YogaInitialContext & YogaServerContext) {
	const db = getDB(event.env);
	return { ...event, db };
}

export type Context = ReturnType<typeof context>;
