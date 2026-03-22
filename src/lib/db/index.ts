import "@tanstack/react-start/server-only";

import { getTableConfig } from "drizzle-orm/sqlite-core";

import { relations } from "./relations";
import * as dbSchema from "./schema";

export * from "./utils";

export { dbSchema, relations, getTableConfig };
export type { DBInstance, TransactionInstance } from "./client";
