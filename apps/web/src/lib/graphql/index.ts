import { cacheExchange } from "@urql/exchange-graphcache";
import { refocusExchange } from "@urql/exchange-refocus";
import { Client, fetchExchange } from "@urql/svelte";

import { PUBLIC_API_URL } from "$env/static/public";

import { getAccessToken } from "$lib/authentication";
import {
	ImportantPageQueryDocument,
	type MarkThreadSeenMutation,
	type MarkThreadSeenMutationVariables,
} from "$lib/graphql/generated/graphql";

export const urqlClient = new Client({
	url: new URL("/graphql", PUBLIC_API_URL).toString(),
	exchanges: [
		refocusExchange(),
		cacheExchange({
			globalIDs: true,
			updates: {
				Mutation: {
					assignTargetMailbox: (_result, _args, cache) => {
						cache.invalidate("Query", "viewer");
					},
					markThreadSeen: (
						result: MarkThreadSeenMutation,
						args: MarkThreadSeenMutationVariables,
						cache
					) => {
						if (!result.markThreadSeen?.id || !args.id) return;

						cache.updateQuery({ query: ImportantPageQueryDocument }, (data) => {
							if (!data?.viewer?.importantMailbox) return data;

							const mailbox = data.viewer.importantMailbox;
							const unseenEdges = mailbox.unseenThreads.edges ?? [];
							const seenEdges = mailbox.seenThreads.edges ?? [];
							const edgeIndex = unseenEdges.findIndex(({ node }) => node?.id === args.id);

							if (edgeIndex === -1) return data;

							const edge = unseenEdges[edgeIndex];
							const nextUnseen = unseenEdges.filter((_, index) => index !== edgeIndex);
							const nextSeen = edge ? [edge, ...seenEdges] : seenEdges;

							return {
								...data,
								viewer: {
									...data.viewer,
									importantMailbox: {
										...mailbox,
										unseenThreadsCount: Math.max(0, mailbox.unseenThreadsCount - 1),
										unseenThreads: {
											...mailbox.unseenThreads,
											edges: nextUnseen,
										},
										seenThreads: {
											...mailbox.seenThreads,
											edges: nextSeen,
										},
									},
								},
							};
						});
					},
				},
			},
		}),
		fetchExchange,
	],
	fetchOptions: () => {
		const token = getAccessToken();
		return {
			headers: { authorization: token ? `Bearer ${token}` : "" },
		};
	},
});
