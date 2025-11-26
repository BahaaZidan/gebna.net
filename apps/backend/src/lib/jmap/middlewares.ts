import type { MiddlewareHandler } from "hono";
import { jwt, type JwtVariables } from "hono/jwt";

import { getDB } from "../../db";
import { userTable } from "../../db/schema";
import type { CreationReferenceMap } from "./types";

export type JMAPHonoAppEnv = {
	Bindings: CloudflareBindings;
	Variables: JwtVariables & {
		user: typeof userTable.$inferSelect;
		accountId: string;
		creationReferences?: CreationReferenceMap;
	};
};

export const requireJWT: MiddlewareHandler<JMAPHonoAppEnv> = (c, next) => {
	const requireAuth = jwt({
		secret: c.env.JWT_SECRET,
		alg: "HS256",
	});

	return requireAuth(c, next);
};

export const attachUserFromJwt: MiddlewareHandler<JMAPHonoAppEnv> = async (c, next) => {
	const payload = c.get("jwtPayload");

	if (!payload || typeof payload.sub !== "string") return c.json({ error: "Unauthorized" }, 401);

	const db = getDB(c.env);
	const user = await db.query.userTable.findFirst({
		where: (t, { eq }) => eq(t.id, payload.sub),
	});
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	c.set("user", user);

	const account = await db.query.accountTable.findFirst({
		columns: { id: true },
		where: (t, { eq }) => eq(t.userId, user.id),
	});
	if (!account) return c.json({ error: "Unauthorized" }, 401);
	c.set("accountId", account.id);

	await next();
};
