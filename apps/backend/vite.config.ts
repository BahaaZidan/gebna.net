import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

const libAlias = new URL("./src/lib", import.meta.url).pathname;

export default defineConfig({
	plugins: [cloudflare()],
	resolve: {
		alias: {
			"@whatwg-node/fetch": "@whatwg-node/fetch/dist/esm-ponyfill.js",
			$lib: libAlias,
		},
	},
});
