import path from "path";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig, Plugin } from "vite";
import { watchAndRun } from "vite-plugin-watch-and-run";

const libAlias = new URL("./src/lib", import.meta.url).pathname;

export default defineConfig({
	plugins: [
		cloudflare({
			remoteBindings: true,
		}),
		watchAndRun([
			{
				name: "graphql:generate",
				watch: [
					path.resolve("../../packages/graphql/schema.graphql"),
					path.resolve("graphql.config.ts"),
				],
				run: "pnpm graphql:generate",
				delay: 10,
				logs: ["streamError"],
			},
		]) as Plugin[],
	],
	resolve: {
		alias: {
			"@whatwg-node/fetch": "@whatwg-node/fetch/dist/esm-ponyfill.js",
			$lib: libAlias,
		},
	},
});
