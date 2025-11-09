import { WorkerEntrypoint } from "cloudflare:workers";
import { Hono } from "hono";

import { auth } from "./auth.routes";
import { email } from "./email-inbound";

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.route("/auth", auth);

app.get("/lolo", (c) => {
	const lolo = { lolo: "lolo" };
	console.log(c.env);

	return c.json(lolo);
});

export default {
	async fetch(req, env, ctx) {
		return app.fetch(req, env, ctx);
	},
	async email(message, env, ctx) {
		return await email(message, env, ctx);
	},
} satisfies ExportedHandler<CloudflareBindings>;

// export default class extends WorkerEntrypoint<CloudflareBindings> {
// 	fetch = app.fetch;
// 	email(message: any, env: CloudflareBindings, ctx: any) {
// 		return email(message, env, ctx);
// 	}
// }
