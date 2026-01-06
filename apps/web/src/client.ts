import { PUBLIC_API_URL } from "$env/static/public";
import { HoudiniClient } from "$houdini";

import { SessionToken } from "$lib/auth";

export default new HoudiniClient({
	url: new URL("/graphql", PUBLIC_API_URL).toString(),
	fetchParams() {
		const token = SessionToken.value;
		return {
			headers: {
				Authorization: token ? `Bearer ${token}` : "",
			},
		};
	},
});
