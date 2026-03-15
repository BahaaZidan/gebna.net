import { getAuthServer, svelteKitHandler } from "@gebna/auth/server";
import { getDB } from "@gebna/db";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";

import { building } from "$app/environment";
import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";

import { workAroundFetch } from "$lib/workaround-fetch";

const handleAuth: Handle = async ({ event, resolve }) => {
	const db = getDB({
		authToken: env.TURSO_AUTH_TOKEN,
		url: env.TURSO_DATABASE_URL,
		fetch: workAroundFetch,
	});
	const auth = getAuthServer({
		db,
		baseURL: env.BASE_URL,
		getRequestEvent,
		secret: env.BETTER_AUTH_SECRET,
	});

	const session = await auth.api.getSession({ headers: event.request.headers });
	if (session) {
		event.locals.session = session.session;
		// @ts-expect-error We have multiple runtime gurantees to ensure username is never null. So ignoring this is safe.
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle = sequence(handleAuth);
