import { getDB } from "@gebna/db";
import { env } from "cloudflare:workers";

import { workAroundFetch } from "./workaround-fetch";

export const db = getDB({
	url: env.TURSO_DATABASE_URL,
	authToken: env.TURSO_AUTH_TOKEN,
	fetch: workAroundFetch,
});
