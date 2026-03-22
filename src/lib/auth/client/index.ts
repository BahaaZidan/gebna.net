import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export * from "./components";

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_BASE_URL,
	plugins: [usernameClient()],
});
