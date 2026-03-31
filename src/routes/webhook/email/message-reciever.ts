import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/webhook/email/message-reciever")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const requestBody = await request.json();

				console.log({ requestBody });

				return new Response(null, {
					status: 200,
				});
			},
		},
	},
});
