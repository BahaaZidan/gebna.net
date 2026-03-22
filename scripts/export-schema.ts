import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { lexicographicSortSchema, printSchema } from "graphql";

import { executableSchema } from "../src/lib/graphql/schema";

const outFile = "./src/lib/graphql/schema.graphql";

mkdirSync(dirname(outFile), { recursive: true });

const sdl = printSchema(lexicographicSortSchema(executableSchema));
writeFileSync(outFile, sdl, "utf8");

console.log(`[schema] wrote ${outFile}`);
