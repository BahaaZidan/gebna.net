import { createFileRoute } from "@tanstack/react-router";

/** This will be triggered when we detect an issue with the DNS configuration for any domain for this server. */
export const Route = createFileRoute("/webhook/email/domain-dns-error")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const requestBody = await request.json();

				console.log(JSON.stringify(requestBody, null, 4));

				return new Response(null, {
					status: 200,
				});
			},
		},
	},
});
