import { WorkerEntrypoint } from "cloudflare:workers";
import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.use(logger());

app.get("/lolo", (c) => {
	const lolo = { lolo: "lolo" };

	return c.json(lolo);
});

export default class extends WorkerEntrypoint<CloudflareBindings> {
	fetch(req: Request) {
		return app.fetch(req, this.env, this.ctx);
	}
	email(message: ForwardableEmailMessage) {
		return;
	}
}
