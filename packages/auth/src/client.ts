import { createAuthClient } from "better-auth/client";
import { usernameClient } from "better-auth/client/plugins";

export function getAuthClient({ baseURL }: { baseURL: string }) {
	return createAuthClient({
		baseURL,
		plugins: [usernameClient()],
	});
}
