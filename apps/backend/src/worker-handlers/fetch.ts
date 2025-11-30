import { Hono } from "hono";
import { logger } from "hono/logger";

import { authenticationApp } from "../lib/hono-apps/authentication";

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.use(logger());

app.route("/auth", authenticationApp);

app.get("/lolo", (c) => {
	const lolo = { lolo: "lolo" };

	return c.json(lolo);
});

export const fetchHandler = app.fetch;
