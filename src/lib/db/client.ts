import "@tanstack/react-start/server-only";

import type { ResultSet } from "@libsql/client/web";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/libsql/web";
import type { SQLiteTransaction } from "drizzle-orm/sqlite-core";

import { relations } from "./relations";

/** Until drizzle supports the turso serverless driver, we need this abomination */
const workAroundFetch: typeof fetch = async (input, init) => {
	if (typeof input === "string" || input instanceof URL) {
		return fetch(input, init);
	}
	if (input && typeof input === "object" && "url" in input) {
		const requestLike = input as {
			url: string;
			method?: string;
			headers?: Headers;
			body?: unknown;
			redirect?: RequestRedirect;
			signal?: AbortSignal | null;
			arrayBuffer?: () => Promise<ArrayBuffer>;
		};
		const headers = new Headers();
		requestLike.headers?.forEach((value, key) => headers.append(key, value));
		const body =
			requestLike.arrayBuffer && requestLike.body != null
				? await requestLike.arrayBuffer()
				: (requestLike.body as BodyInit | null | undefined);
		return fetch(requestLike.url, {
			method: requestLike.method,
			headers,
			body,
			redirect: requestLike.redirect,
			signal: requestLike.signal ?? undefined,
		});
	}
	return fetch(input as RequestInfo, init);
};

export const db = drizzle({
	relations,
	connection: {
		url: env.TURSO_DATABASE_URL,
		authToken: env.TURSO_AUTH_TOKEN,
		fetch: workAroundFetch,
	},
});

export type DBInstance = typeof db;

export type TransactionInstance = SQLiteTransaction<
	"async",
	ResultSet,
	Record<string, never>,
	typeof relations
>;
