import { createFileRoute } from "@tanstack/react-router";

import { auth } from "#/lib/auth/server";
import { handleGraphQLRequest } from "#/lib/graphql";

const handleRequest = async (request: Request) => {
	const session = await auth.api.getSession({
		headers: request.headers,
		asResponse: false,
	});
	return handleGraphQLRequest(request, session?.user);
};

export const Route = createFileRoute("/api/graphql/$")({
	server: {
		handlers: {
			GET: ({ request }) => handleRequest(request),
			POST: ({ request }) => handleRequest(request),
			OPTIONS: ({ request }) => handleRequest(request),
		},
	},
});
