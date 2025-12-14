import type { CodegenConfig } from "@graphql-codegen/cli";
import type { IGraphQLConfig } from "graphql-config";

const config: IGraphQLConfig = {
	schema: ["../../packages/graphql/schema.graphql"],
	documents: ["./src/**/*.{gql,graphql,svelte,ts}"],
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
				"./src/lib/graphql/generated/": {
					preset: "client",
					config: {
						enumsAsTypes: true,
						useTypeImports: true,
						scalars: {
							DateTime: "string",
							URL: "string",
						},
					},
				},
			},
		} satisfies CodegenConfig,
	},
};

export default config;
