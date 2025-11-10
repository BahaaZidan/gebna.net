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
	fetch: app.fetch,
	email,
} satisfies ExportedHandler<CloudflareBindings>;
