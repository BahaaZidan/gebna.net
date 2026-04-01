import { createFileRoute } from "@tanstack/react-router";

/** An e-mail has been held in Postal. This will be because a limit has been reached (rate limit or spam detection) or your server is in development mode. */
export const Route = createFileRoute("/webhook/email/message-held")({
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
