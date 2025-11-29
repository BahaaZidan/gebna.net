import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.use(logger());

app.get("/lolo", (c) => {
	const lolo = { lolo: "lolo" };

	return c.json(lolo);
});

export const fetchHandler = app.fetch;
