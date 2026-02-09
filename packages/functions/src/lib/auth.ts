import { getAuthServer } from "@gebna/auth/server";

import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";

import { db } from "./db.ts";

export const auth = getAuthServer({
	db,
	getRequestEvent,
	baseURL: env.BASE_URL,
	secret: env.BETTER_AUTH_SECRET,
});
