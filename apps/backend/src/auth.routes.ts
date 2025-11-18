import { v } from "@gebna/validation";
import { loginSchema, registerSchema } from "@gebna/validation/auth";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { JwtVariables } from "hono/jwt";

import { hashPassword, hmacRefresh, nowSec, randomHex, verifyPassword } from "./auth/crypto";
import { requireRefreshBearer } from "./auth/guards";
import { ACCESS_TTL, REFRESH_TTL, signAccessJWT } from "./auth/token";
import { getDB } from "./db";
import { accountTable, mailboxTable, sessionTable, userTable } from "./db/schema";
import { requireJWT } from "./lib/jmap/middlewares";

type Variables = JwtVariables & {
	sessionRow: typeof sessionTable.$inferSelect;
};
export const auth = new Hono<{ Bindings: CloudflareBindings; Variables: Variables }>();

auth.post("/register", async (c) => {
	const input = await c.req.json();
	const inputValidation = v.safeParse(registerSchema, input);
	if (!inputValidation.success) {
		return c.json({ errors: inputValidation.issues }, 400);
	}

	const db = getDB(c.env);
	const username = inputValidation.output.username;
	const emailAddress = `${username}@gebna.net`;
	const now = new Date();

	try {
		const result = await db.transaction(async (tx) => {
			// 1) check username
			const existingUser = await tx.query.userTable.findFirst({
				columns: { id: true },
				where: (t, { eq }) => eq(t.username, username),
			});
			if (existingUser) {
				return { type: "USERNAME_TAKEN" as const };
			}

			// 2) create user
			const phc = await hashPassword(inputValidation.output.password);

			const [user] = await tx
				.insert(userTable)
				.values({
					id: crypto.randomUUID(),
					username,
					passwordHash: phc,
					// createdAt: now, // if you have this column
				})
				.returning();

			if (!user) {
				throw new Error("USER_INSERT_FAILED");
			}

			// 3) create mail account
			const accountId = crypto.randomUUID();

			await tx.insert(accountTable).values({
				id: accountId,
				address: emailAddress,
				userId: user.id,
				createdAt: now,
			});

			// 4) default mailboxes for this account
			const mkBox = (name: string, role?: string | null, sortOrder = 0) => ({
				id: crypto.randomUUID(),
				accountId,
				name,
				role: role ?? null,
				sortOrder,
				createdAt: now,
			});

			await tx.insert(mailboxTable).values([
				mkBox("Inbox", "inbox", 10),
				mkBox("Sent", "sent", 20),
				mkBox("Drafts", "drafts", 30),
				mkBox("Archive", "archive", 40),
				mkBox("Trash", "trash", 50),
				mkBox("Spam", "spam", 60),
				// later: mkBox("Paper Trail", "paper-trail", 70),
				// later: mkBox("The Feed", "feed", 80),
			]);

			return { type: "OK" as const, userId: user.id };
		});

		if (result.type === "USERNAME_TAKEN") {
			return c.json({ error: "Username taken!" }, 409);
		}

		// 5) create session as before
		const session = await createSession(c.env, {
			userId: result.userId,
			ip: c.req.header("CF-Connecting-IP"),
			userAgent: c.req.header("User-Agent"),
		});

		return c.json(session);
	} catch (err) {
		// optional: detect unique violation on accountTable.address and map to 409
		console.error(err);
		return c.json({ error: "Unexpected failure!" }, 500);
	}
});

auth.post("/login", async (c) => {
	const input = await c.req.json();
	const inputValidation = v.safeParse(loginSchema, input);
	if (!inputValidation.success) return c.json({ errors: inputValidation.issues }, 400);

	const db = getDB(c.env);
	const user = await db.query.userTable.findFirst({
		where: (t, { eq }) => eq(t.username, inputValidation.output.username),
	});
	if (!user) return c.json({ error: "Invalid credentials!" }, 401);

	const isPasswordMatching = await verifyPassword(
		user.passwordHash,
		inputValidation.output.password
	);
	if (!isPasswordMatching) return c.json({ error: "Invalid credentials!" }, 401);

	const session = await createSession(c.env, {
		userId: user.id,
		ip: c.req.header("CF-Connecting-IP"),
		userAgent: c.req.header("User-Agent"),
	});

	return c.json(session);
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

auth.post("/logout", requireRefreshBearer, async (c) => {
	const row = c.get("sessionRow");
	const db = getDB(c.env);
	// TODO: why not remove the session row completely ?
	await db.update(sessionTable).set({ revoked: true }).where(eq(sessionTable.id, row.id));
	return c.json({ ok: true });
});

auth.get("/me", requireJWT, async (c) => {
	const { sub } = c.get("jwtPayload") as { sub: string };
	const db = getDB(c.env);
	const u = await db.query.userTable.findFirst({ where: (t, { eq }) => eq(t.id, sub) });
	if (!u) return c.json({ error: "not found" }, 404);
	return c.json({ id: u.id, username: u.username });
});

async function createSession(
	env: CloudflareBindings,
	data: {
		userId: string;
		userAgent?: string | null;
		ip?: string | null;
	}
) {
	const { userId, userAgent = null, ip = null } = data;
	const id = crypto.randomUUID();
	const refresh = randomHex(64);
	const refreshHash = await hmacRefresh(env, refresh);

	const db = getDB(env);

	await db.insert(sessionTable).values({
		id,
		userId,
		refreshHash,
		userAgent,
		ip,
		createdAt: nowSec(),
		expiresAt: nowSec() + REFRESH_TTL,
		revoked: false,
	});

	const access = await signAccessJWT(env, userId, id);

	return {
		access_token: access,
		token_type: "Bearer",
		expires_in: ACCESS_TTL,
		refresh_token: refresh,
	};
}
