import { cacheExchange } from "@urql/exchange-graphcache";
import { refocusExchange } from "@urql/exchange-refocus";
import { Client, fetchExchange } from "@urql/svelte";

import { PUBLIC_API_URL } from "$env/static/public";

import { getAccessToken } from "$lib/authentication";

export const urqlClient = new Client({
	url: new URL("/graphql", PUBLIC_API_URL).toString(),
	exchanges: [
		refocusExchange(),
		cacheExchange({
			updates: {
				Mutation: {
					assignTargetMailbox: (_result, _args, cache) => {
						cache.invalidate("Query", "viewer");
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
