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
							EmailAddress: "string",
						},
						mappers: {
							Viewer: "$lib/db#UserSelectModel",
							Identity: "$lib/db#IdentitySelectModel",
							IdentityRelationship: "$lib/db#IdentityRelationshipSelectModel",
							Conversation: "$lib/db#ConversationSelectModel",
							ConversationParticipant: "$lib/db#ConversationParticipantSelectModel",
							ConversationViewerState: "$lib/db#ConversationViewerStateSelectModel",
							Message: "$lib/db#MessageSelectModel",
							DeliveryReceipt: "$lib/db#MessageDeliverySelectModel",
						},
						resolversNonOptionalTypename: true,
					} satisfies TypeScriptPluginConfig & TypeScriptResolversPluginConfig,
				},
			},
		} satisfies CodegenConfig,
	},
};

export default config;
