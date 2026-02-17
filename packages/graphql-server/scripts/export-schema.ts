import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { lexicographicSortSchema, printSchema } from "graphql";

// IMPORTANT: import your actual schema export here
import { executableSchema } from "../src/schema/index.js"; // GraphQLSchema

const outFile = "./schema.graphql";

mkdirSync(dirname(outFile), { recursive: true });

const sdl = printSchema(lexicographicSortSchema(executableSchema));
writeFileSync(outFile, sdl, "utf8");

console.log(`[schema] wrote ${outFile}`);
