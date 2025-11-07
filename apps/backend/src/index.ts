import { v } from "@gebna/validation";
import { WorkerEntrypoint } from "cloudflare:workers";
import { Hono } from "hono";

import { email } from "./email-inbound";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => {
	const lolo = { lolo: "lolo" };
	const schema = v.object({
		lolo: v.string(),
	});

	return c.json(v.parse(schema, lolo));
});

export default class extends WorkerEntrypoint<CloudflareBindings> {
	fetch = app.fetch;
	email(message: any, env: CloudflareBindings, ctx: any) {
		return email(message, env, ctx);
	}
}
