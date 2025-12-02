import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [cloudflare()],
	resolve: {
		alias: {
			"@whatwg-node/fetch": "@whatwg-node/fetch/dist/esm-ponyfill.js",
		},
	},
});
