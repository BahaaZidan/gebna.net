import { Hono, type Context } from "hono";

import { seedDemo } from "$lib/seeding/demo";
import { seedRawEmails } from "$lib/seeding/raw-emails";

const seedingApp = new Hono<{ Bindings: CloudflareBindings }>();

seedingApp.use("*", async (c, next) => {
	if (c.env.SEEDING_ENDPOINTS_ENABLED !== "true") {
		return c.json({ ok: false, error: "Seeding endpoints are disabled." }, 403);
	}
	return next();
});

seedingApp.post("/demo", async (c) => {
	const body = await readJsonBody(c);
	const result = await seedDemo(c.env, {
		reset: asBoolean(body.reset),
		username: typeof body.username === "string" ? body.username : undefined,
		password: typeof body.password === "string" ? body.password : undefined,
		name: typeof body.name === "string" ? body.name : undefined,
	});

	return c.json({ ok: true, outcome: result.status, reset: result.resetPerformed, result });
});

seedingApp.post("/raw-emails", async (c) => {
	const body = await readJsonBody(c);
	const result = await seedRawEmails(c.env, {
		reset: asBoolean(body.reset),
		recipientUsername:
			typeof body.recipientUsername === "string" ? body.recipientUsername : undefined,
		recipientEmail: typeof body.recipientEmail === "string" ? body.recipientEmail : undefined,
	});

	return c.json({ ok: true, result });
});

seedingApp.onError((err, c) => {
	console.error("Seeding endpoint error", err);
	return c.json({ ok: false, error: err.message ?? "Unknown error" }, 500);
});

export { seedingApp };

async function readJsonBody(
	c: Context<{ Bindings: CloudflareBindings }>
): Promise<Record<string, unknown>> {
	try {
		const contentType = c.req.header("content-type");
		if (!contentType || !contentType.includes("application/json")) return {};
		return await c.req.json<Record<string, unknown>>();
	} catch {
		return {};
	}
}

function asBoolean(value: unknown) {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") return value.toLowerCase() === "true";
	return false;
}
