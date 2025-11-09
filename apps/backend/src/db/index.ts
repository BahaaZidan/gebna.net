import { drizzle } from "drizzle-orm/libsql";

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
