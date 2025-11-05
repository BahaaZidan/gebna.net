import { defineConfig } from "drizzle-kit";
import * as v from "valibot";

const schema = v.object({
	CF_ACCOUNT_ID: v.string(),
	CF_D1_DB_ID: v.string(),
	CF_D1_TOKEN: v.string(),
});
const env = v.parse(schema, process.env);

export default defineConfig({
	schema: "./src/lib/server/db/schema.ts",
	dialect: "sqlite",
	driver: "d1-http",
	dbCredentials: {
		accountId: env.CF_ACCOUNT_ID,
		databaseId: env.CF_D1_DB_ID,
		token: env.CF_D1_TOKEN,
	},
	verbose: true,
	strict: true,
});
