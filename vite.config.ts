import path from "path";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { watchAndRun } from "vite-plugin-watch-and-run";
import tsconfigPaths from "vite-tsconfig-paths";

const srcRoot = `${path.resolve("src")}${path.sep}`;
const schemaRoot = `${path.resolve("src/lib/graphql/schema")}${path.sep}`;
const relayGeneratedDir = `${path.sep}__generated__${path.sep}`;

function isSrcTypeScriptFile(filePath: string) {
	return (
		filePath.startsWith(srcRoot) &&
		(filePath.endsWith(".ts") || filePath.endsWith(".tsx"))
	);
}

const config = defineConfig({
	plugins: [
		watchAndRun([
			{
				name: "gql:schema-gen",
				watch: path.resolve("src/lib/graphql/schema/**/*.ts"),
				run: "pnpm gql:schema-gen && relay-compiler",
				delay: 200,
			},
			{
				name: "relay-compiler",
				watchFile: async (filePath) =>
					isSrcTypeScriptFile(filePath) &&
					!filePath.startsWith(schemaRoot) &&
					!filePath.includes(relayGeneratedDir),
				run: "relay-compiler",
				delay: 200,
			},
		]),
		devtools({
			consolePiping: {
				enabled: false,
			},
		}),
		tsconfigPaths({ projects: ["./tsconfig.json"] }),
		tailwindcss(),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tanstackStart(),
		viteReact({
			babel: {
				plugins: ["babel-plugin-react-compiler", "relay"],
			},
		}),
	],
});

export default config;
