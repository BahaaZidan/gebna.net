import { WorkerEntrypoint } from "cloudflare:workers";
import { Hono } from "hono";
import { logger } from "hono/logger";

import { auth } from "./auth.routes";
import { email } from "./email-inbound";
import { jmapApp } from "./jmap.routes";
import {
	cleanupOrphanedBlobsForEnv,
	enforceMailboxRoleConstraintsForEnv,
} from "./lib/maintenance/upload-cleanup";
import { processEmailSubmissionQueue } from "./lib/outbound/submission-queue";
import { sesWebhookApp } from "./ses-webhook.routes";

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.use(logger());
app.route("/auth", auth);
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
				await cleanupOrphanedBlobsForEnv(this.env);
				await enforceMailboxRoleConstraintsForEnv(this.env);
				break;
			default:
				break;
		}
	}
}
