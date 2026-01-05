import houdini from "houdini/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [houdini(), tailwindcss(), sveltekit()],
	server: {
		port: 5174,
	},
	optimizeDeps: { exclude: ["@urql/svelte"] },
});
