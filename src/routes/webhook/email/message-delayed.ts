import { createFileRoute } from "@tanstack/react-router";

/** An e-mail has been delayed due to an issue with the receiving endpoint. It will be retried automatically. */
export const Route = createFileRoute("/webhook/email/message-delayed")({
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
