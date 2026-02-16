import type { CodegenConfig } from "@graphql-codegen/cli";
import type { IGraphQLConfig } from "graphql-config";

const config: IGraphQLConfig = {
	schema: ["./schema.ts"],
	documents: [
		"./src/**/*.{svelte,ts}",
		"../ui/src/components/**/*.{svelte}",
		"../../apps/desktop/src/**/*.{svelte,ts}",
		"../../apps/mobile/src/**/*.{svelte,ts}",
	],
	extensions: {
		codegen: {
			ignoreNoDocuments: true,
			pluckConfig: {
				modules: [
					{ name: "@urql/core", identifier: "gql" },
					{ name: "@urql/svelte", identifier: "gql" },
				],
			},
			generates: {
				"./src/generated/": {
					preset: "client",
					config: {
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
