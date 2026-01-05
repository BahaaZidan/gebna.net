import { HoudiniClient } from "$houdini";

import { getAccessToken } from "$lib/authentication";

export default new HoudiniClient({
	url: "http://localhost:5173/graphql",
	fetchParams() {
		const token = getAccessToken();
		return {
			headers: {
				authentication: token ? `Bearer ${token}` : "",
			},
		};
	},
});
