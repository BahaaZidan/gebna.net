import { ResultSet } from "@libsql/client";
import { ExtractTablesWithRelations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { SQLiteTransaction } from "drizzle-orm/sqlite-core";

import * as schema from "./schema";

export { schema };

export const getDB = (env: CloudflareBindings) =>
	drizzle({
		schema,
		connection: {
			url: env.TURSO_DATABASE_URL,
			authToken: env.TURSO_AUTH_TOKEN,
		},
	});

export type DBInstance = ReturnType<typeof getDB>;

export type TransactionInstance = SQLiteTransaction<
	"async",
	ResultSet,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;
