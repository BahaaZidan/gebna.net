import { Hono } from "hono";
import { logger } from "hono/logger";

import { graphqlRequestHandler } from "$lib/graphql/requestHandler";
import { authenticationApp } from "$lib/hono-apps/authentication";
import { seedingApp } from "$lib/hono-apps/seeding";

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.use(logger());

app.route("/auth", authenticationApp);
app.route("/seed", seedingApp);
app.use("/graphql", async (c) => {
	const request = new Request(c.req.url, {
		method: c.req.method,
		headers: c.req.raw.headers,
		body: c.req.raw.body,
	});

	return graphqlRequestHandler.handleRequest(request, {
		env: c.env,
		executionCtx: c.executionCtx,
	});
});

export const fetchHandler = app.fetch;
