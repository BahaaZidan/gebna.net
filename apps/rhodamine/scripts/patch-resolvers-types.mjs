import { readFile, writeFile } from "node:fs/promises";

const FILE = "src/lib/graphql/resolvers.types.ts";

const original = await readFile(FILE, "utf8");

if (
	original.includes(
		"AsyncIterable<TResult> | Promise<AsyncIterable<TResult>> | TResult | Promise<TResult>",
	)
) {
	process.exit(0);
}

const pattern =
	/(export type SubscriptionSubscribeFn[\s\S]*?\)\s*=>\s*)AsyncIterable<TResult>\s*\|\s*Promise<AsyncIterable<TResult>>;/m;

const updated = original.replace(
	pattern,
	"$1AsyncIterable<TResult> | Promise<AsyncIterable<TResult>> | TResult | Promise<TResult>;",
);

if (updated === original) {
	throw new Error(`patch-resolvers-types: no match found in ${FILE}`);
}

await writeFile(FILE, updated, "utf8");
