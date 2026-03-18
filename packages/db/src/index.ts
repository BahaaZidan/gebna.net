import type { ResultSet } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql/web";
import { getTableConfig, type SQLiteTransaction } from "drizzle-orm/sqlite-core";

import { relations } from "./relations.js";
import * as schema from "./schema.js";

export { schema as dbSchema, relations, getTableConfig };
export * from "./utils.js";
export { eq, and, or } from "drizzle-orm";

export const getDB = ({
	url,
	authToken,
	fetch,
}: {
	url: string;
	authToken: string;
	fetch?: typeof globalThis.fetch;
}) => {
	return drizzle({
		relations,
		connection: { url, authToken, fetch },
		logger: true,
	});
};

export type DBInstance = ReturnType<typeof getDB>;

export type TransactionInstance = SQLiteTransaction<
	"async",
	ResultSet,
	Record<string, never>,
	typeof relations
>;
