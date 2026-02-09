import { createAuthClient } from "better-auth/client";
import { usernameClient } from "better-auth/client/plugins";

export function getAuthClient() {
	return createAuthClient({
		plugins: [usernameClient()],
	});
}
