import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { jwt } from "hono/jwt";

import { hashPassword, hmacRefresh, nowSec, randomHex, verifyPassword } from "./auth/crypto";
import { requireRefreshBearer } from "./auth/guards";
import { ACCESS_TTL, REFRESH_TTL, signAccessJWT } from "./auth/token";
import { getDB } from "./db";
import { sessionTable, userTable } from "./db/schema";

type Variables = {
	sessionRow: typeof sessionTable.$inferSelect;
};
export const auth = new Hono<{ Bindings: CloudflareBindings; Variables: Variables }>();

auth.post("/register", async (c) => {
	const { username, password } = await c.req.json<{ username: string; password: string }>();
	if (!username || !password) return c.json({ error: "missing fields" }, 400);

	console.log(c);
	const db = getDB(c.env);
	const exists = await db.query.userTable.findFirst({
		where: (t, { eq }) => eq(t.username, username),
	});
	if (exists) return c.json({ error: "username taken" }, 409);

	const phc = await hashPassword(password);
	await db.insert(userTable).values({ id: crypto.randomUUID(), username, passwordHash: phc });
	return c.json({ ok: true });
});

// POST /auth/login { username, password }
auth.post("/login", async (c) => {
	const { username, password } = await c.req.json<{ username: string; password: string }>();
	const db = getDB(c.env);
	const u = await db.query.userTable.findFirst({ where: (t, { eq }) => eq(t.username, username) });
	if (!u) return c.json({ error: "invalid credentials" }, 401);

	const ok = await verifyPassword(u.passwordHash, password);
	if (!ok) return c.json({ error: "invalid credentials" }, 401);

	const sid = crypto.randomUUID();
	const refresh = randomHex(64);
	const refreshHash = await hmacRefresh(c.env, refresh);

	await db.insert(sessionTable).values({
		id: sid,
		userId: u.id,
		refreshHash,
		userAgent: c.req.header("User-Agent") ?? null,
		ip: c.req.header("CF-Connecting-IP") ?? null,
		createdAt: nowSec(),
		expiresAt: nowSec() + REFRESH_TTL,
		revoked: false,
	});

	const access = await signAccessJWT(c.env, u.id, sid);

	return c.json({
		access_token: access,
		token_type: "Bearer",
		expires_in: ACCESS_TTL,
		refresh_token: refresh,
	});
});

auth.post("/refresh", requireRefreshBearer, async (c) => {
	const row = c.get("sessionRow");
	const newRefresh = randomHex(64);
	const newHash = await hmacRefresh(c.env, newRefresh);

	const db = getDB(c.env);
	await db
		.update(sessionTable)
		.set({ refreshHash: newHash, createdAt: nowSec(), expiresAt: nowSec() + REFRESH_TTL })
		.where(eq(sessionTable.id, row.id));

	const access = await signAccessJWT(c.env, row.userId, row.id);

	return c.json({
		access_token: access,
		token_type: "Bearer",
		expires_in: ACCESS_TTL,
		refresh_token: newRefresh,
	});
});

// POST /auth/logout    (Authorization: Bearer <refresh>)
auth.post("/logout", requireRefreshBearer, async (c) => {
	const row = c.get("sessionRow");
	const db = getDB(c.env);
	await db.update(sessionTable).set({ revoked: true }).where(eq(sessionTable.id, row.id));
	return c.json({ ok: true });
});

auth.get(
	"/me",
	// TODO: modularize
	(c, next) => {
		const requireAuth = jwt({
			secret: c.env.JWT_SECRET,
			alg: "HS256",
		});

		return requireAuth(c, next);
	},
	async (c) => {
		const { sub } = c.get("jwtPayload") as { sub: string };
		const db = getDB(c.env);
		const u = await db.query.userTable.findFirst({ where: (t, { eq }) => eq(t.id, sub) });
		if (!u) return c.json({ error: "not found" }, 404);
		return c.json({ id: u.id, username: u.username });
	}
);
