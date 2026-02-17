import type { ResultSet } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getTableConfig, type SQLiteTransaction } from "drizzle-orm/sqlite-core";

import { relations } from "./relations.js";
import * as schema from "./schema.js";

export { schema as dbSchema, relations, getTableConfig };

export const getDB = ({ url, authToken }: { url: string; authToken: string }) =>
	drizzle({
		relations,
		// schema,
		connection: { url, authToken },
	});

export type DBInstance = ReturnType<typeof getDB>;

export type TransactionInstance = SQLiteTransaction<
	"async",
	ResultSet,
	typeof schema,
	typeof relations
>;
