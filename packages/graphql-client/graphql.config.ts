import type { CodegenConfig } from "@graphql-codegen/cli";
import type { IGraphQLConfig } from "graphql-config";

const config: IGraphQLConfig = {
	schema: "../graphql-server/schema.graphql",
	documents: [
		"../ui/src/components/**/*.{svelte}",
		"../../apps/desktop/src/**/*.{svelte,ts}",
		"../../apps/mobile/src/**/*.{svelte,ts}",
	],
	extensions: {
		codegen: {
			importExtension: ".js",
			ignoreNoDocuments: true,
			generates: {
				"./src/generated/": {
					preset: "client",
					config: {
						documentMode: "string",
						enumsAsTypes: true,
						useTypeImports: true,
						scalars: {
							DateTime: "string",
							URL: "string",
							EmailAddress: "string",
						},
					},
				},
			},
		} satisfies CodegenConfig,
	},
};

export default config;
