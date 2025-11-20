import { WorkerEntrypoint } from "cloudflare:workers";
import { Hono } from "hono";

import { auth } from "./auth.routes";
import { email } from "./email-inbound";
import { jmapFilesApp } from "./jmap-blob.routes";
import { jmapApp } from "./jmap.routes";
import { cleanupExpiredUploadTokensForEnv } from "./lib/maintenance/upload-cleanup";
import { processEmailSubmissionQueue } from "./lib/outbound/submission-queue";
import { sesWebhookApp } from "./ses-webhook.routes";

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.route("/auth", auth);
app.route("/blobs", jmapFilesApp);
app.route("/", jmapApp);
app.route("/ses", sesWebhookApp);

app.get("/lolo", (c) => {
	const lolo = { lolo: "lolo" };
	console.log(c.env);

	return c.json(lolo);
});

export default class extends WorkerEntrypoint<CloudflareBindings> {
	fetch(req: Request) {
		return app.fetch(req, this.env, this.ctx);
	}
	email(message: ForwardableEmailMessage) {
		return email(message, this.env, this.ctx);
	}
	async scheduled(controller: ScheduledController) {
		switch (controller.cron) {
			case "*/1 * * * *":
				await processEmailSubmissionQueue(this.env);
				break;
			case "0 * * * *":
				await cleanupExpiredUploadTokensForEnv(this.env);
				break;
			default:
				break;
		}
	}
}
