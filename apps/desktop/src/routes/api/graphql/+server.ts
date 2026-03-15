import { getDB } from "@gebna/db";
import { createYoga } from "@gebna/graphql-server";

import { env } from "$env/dynamic/private";

import { workAroundFetch } from "$lib/workaround-fetch";

import type { RequestEvent, RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	const db = getDB({
		authToken: env.TURSO_AUTH_TOKEN,
		url: env.TURSO_DATABASE_URL,
		fetch: workAroundFetch,
	});
	const handler = createYoga<RequestEvent>({
		db,
		viewer: event.locals.user,
		introspection: env.DEVELOPMENT === "true",
	}).handleRequest;
	const response = await handler(event.request, event);

	return response;
};

export const POST: RequestHandler = async (event) => {
	const db = getDB({
		authToken: env.TURSO_AUTH_TOKEN,
		url: env.TURSO_DATABASE_URL,
		fetch: workAroundFetch,
	});
	const handler = createYoga<RequestEvent>({
		db,
		viewer: event.locals.user,
		introspection: env.DEVELOPMENT === "true",
	}).handleRequest;
	const response = await handler(event.request, event);

	return response;
};

export const OPTIONS: RequestHandler = async (event) => {
	const db = getDB({
		authToken: env.TURSO_AUTH_TOKEN,
		url: env.TURSO_DATABASE_URL,
		fetch: workAroundFetch,
	});
	const handler = createYoga<RequestEvent>({
		db,
		viewer: event.locals.user,
		introspection: env.DEVELOPMENT === "true",
	}).handleRequest;
	const response = await handler(event.request, event);

	return response;
};
