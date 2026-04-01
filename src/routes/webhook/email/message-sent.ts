import { createFileRoute } from "@tanstack/react-router";

/** An e-mail has been successfully delivered to its endpoint (either SMTP or HTTP). */
export const Route = createFileRoute("/webhook/email/message-sent")({
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
