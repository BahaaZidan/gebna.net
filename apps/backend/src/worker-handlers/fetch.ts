import { Hono } from "hono";
import { logger } from "hono/logger";

import { graphqlRequestHandler } from "../lib/graphql/requestHandler";
import { authenticationApp } from "../lib/hono-apps/authentication";

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.use(logger());

app.route("/auth", authenticationApp);
app.use("/graphql", async (c) => {
	const request = new Request(c.req.url, {
		method: c.req.method,
		headers: c.req.raw.headers,
		body: c.req.raw.body,
	});

	return graphqlRequestHandler.fetch(request, {
		env: c.env,
		executionCtx: c.executionCtx,
	});
});

app.get("/lolo", (c) => {
	const lolo = { lolo: "lolo" };

	return c.json(lolo);
});

export const fetchHandler = app.fetch;
