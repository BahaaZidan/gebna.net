import { createFileRoute } from "@tanstack/react-router";

import {
	handlePostalOutboundWebhookEvent,
	parsePostalOutboundWebhookEvent,
} from "#/lib/email";

export const Route = createFileRoute("/webhook/email/postal")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				let requestBody: unknown;

				try {
					requestBody = await request.json();
				} catch {
					return Response.json(
						{
							ok: false,
							error: "Invalid JSON payload",
						},
						{
							status: 400,
						},
					)
				}

				const event = parsePostalOutboundWebhookEvent(requestBody);

				if (!event) {
					return Response.json(
						{
							ok: false,
							error: "Unsupported Postal outbound webhook payload",
						},
						{
							status: 400,
						},
					)
				}

				await handlePostalOutboundWebhookEvent(event);

				return Response.json({
					ok: true,
					type: event.type,
				})
			},
		},
	},
});
