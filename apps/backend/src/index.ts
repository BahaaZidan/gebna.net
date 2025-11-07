import { v } from "@gebna/validation";
import { Hono } from "hono";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => {
	const lolo = { lolo: "lolo" };
	const schema = v.object({
		lolo: v.string(),
	});

	return c.json(v.parse(schema, lolo));
});

export default {
	fetch: app.fetch,
} satisfies ExportedHandler<CloudflareBindings>;
