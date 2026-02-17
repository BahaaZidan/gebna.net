import { cacheExchange } from "@urql/exchange-graphcache";
import { refocusExchange } from "@urql/exchange-refocus";
import { retryExchange } from "@urql/exchange-retry";
import { fetchExchange, type ClientOptions } from "@urql/svelte";

export function buildURQLFetchOptions(signal?: AbortSignal | null | undefined): RequestInit {
	return {
		credentials: "include",
		signal,
	};
}

export const clientOptions: ClientOptions = {
	url: "/api/graphql",
	exchanges: [
		refocusExchange(),
		cacheExchange({
			globalIDs: true,
			updates: {},
		}),
		retryExchange(),
		fetchExchange,
	],
	fetchOptions: () => {
		return buildURQLFetchOptions();
	},
};
