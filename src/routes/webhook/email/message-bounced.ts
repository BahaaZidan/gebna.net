import { createFileRoute } from "@tanstack/react-router";

/** We received a bounce message in response to an email which had previously been successfully sent. */
export const Route = createFileRoute("/webhook/email/message-bounced")({
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
