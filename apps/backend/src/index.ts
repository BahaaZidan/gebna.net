import { WorkerEntrypoint } from "cloudflare:workers";
import { Hono } from "hono";

import { auth } from "./auth.routes";
import { email } from "./email-inbound";
import { jmapFilesApp } from "./jmap-blob.routes";
import { jmapApp } from "./jmap.routes";
import { processEmailSubmissionQueue } from "./lib/outbound/submission-queue";
import { cleanupExpiredUploadTokensForEnv } from "./lib/maintenance/upload-cleanup";

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.route("/auth", auth);
app.route("/blobs", jmapFilesApp);
app.route("/", jmapApp);

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
	async scheduled(_controller: ScheduledController) {
		await processEmailSubmissionQueue(this.env);
		await cleanupExpiredUploadTokensForEnv(this.env);
	}
}
