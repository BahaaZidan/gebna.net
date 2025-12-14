import type { CodegenConfig } from "@graphql-codegen/cli";
import type { TypeScriptPluginConfig } from "@graphql-codegen/typescript";
import type { TypeScriptResolversPluginConfig } from "@graphql-codegen/typescript-resolvers";
import type { IGraphQLConfig } from "graphql-config";

const config: IGraphQLConfig = {
	schema: ["../../packages/graphql/schema.graphql"],
	extensions: {
		codegen: {
			generates: {
				"./src/lib/graphql/resolvers.types.ts": {
					plugins: [
						{
							add: {
								content: "/* eslint-disable */",
							},
						},
						"typescript",
						"typescript-resolvers",
					],
					config: {
						enumsAsTypes: true,
						maybeValue: "T | null | undefined",
						useTypeImports: true,
						contextType: "$lib/graphql/context#Context",
						scalars: {
							ID: "string",
							DateTime: "Date",
							URL: "URL",
						},
						mappers: {
							User: "$lib/db#UserSelectModel",
							Mailbox: "$lib/db#MailboxSelectModel",
							Thread: "$lib/db#ThreadSelectModel",
							Message: "$lib/db#MessageSelectModel",
							Contact: "$lib/db#AddressUserSelectModel",
						},
						resolversNonOptionalTypename: true,
					} satisfies TypeScriptPluginConfig & TypeScriptResolversPluginConfig,
				},
			},
		} satisfies CodegenConfig,
	},
};

export default config;
