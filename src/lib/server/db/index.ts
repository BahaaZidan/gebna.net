import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

export type DB = ReturnType<typeof drizzle<typeof schema>>;

export const getDB = (db?: D1Database): DB => {
	if (!db) throw new Error("DATABASE NOT FOUND!");
	return drizzle<typeof schema>(db, {
		schema,
	});
};
