import { createFileRoute } from "@tanstack/react-router";

/** An e-mail cannot be delivered to its endpoint. This is a permanent failure so it will not be retried. */
export const Route = createFileRoute("/webhook/email/message-delivery-failed")({
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
