/// <references types="houdini-svelte">

/** @type {import('houdini').ConfigFile} */
const config = {
	schemaPath: "../../packages/graphql/schema.graphql",
	runtimeDir: ".houdini",
	plugins: {
		"houdini-svelte": {},
	},
	features: {
		imperativeCache: true,
	},
};

export default config;
