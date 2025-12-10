import { cacheExchange, Client, fetchExchange } from "@urql/svelte";

import { PUBLIC_API_URL } from "$env/static/public";

import { getAccessToken } from "$lib/authentication";

export const urqlClient = new Client({
	url: new URL("/graphql", PUBLIC_API_URL).toString(),
	exchanges: [cacheExchange, fetchExchange],
	fetchOptions: () => {
		const token = getAccessToken();
		return {
			headers: { authorization: token ? `Bearer ${token}` : "" },
		};
	},
});
