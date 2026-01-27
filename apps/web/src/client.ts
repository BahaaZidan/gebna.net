import { createClient } from "graphql-ws";

import { PUBLIC_API_URL } from "$env/static/public";
import { HoudiniClient } from "$houdini";
import { subscription } from "$houdini/plugins";

import { SessionToken } from "$lib/auth";

const url = new URL("/graphql", PUBLIC_API_URL).toString();

export default new HoudiniClient({
	url,
	plugins: [subscription(() => createClient({ url }))],
	fetchParams() {
		const token = SessionToken.value;
		return {
			headers: {
				Authorization: token ? `Bearer ${token}` : "",
			},
		};
	},
});
