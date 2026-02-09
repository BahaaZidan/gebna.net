import { getDB } from "@gebna/db";

import { env } from "$env/dynamic/private";

export const db = getDB({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
