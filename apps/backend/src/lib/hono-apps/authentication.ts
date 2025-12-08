import { v } from "@gebna/validation";
import { loginSchema, registerSchema } from "@gebna/validation/auth";
import { encodeBase64url } from "@oslojs/encoding";
import { argon2id, argon2Verify, setWASMModules } from "argon2-wasm-edge";
// @ts-expect-error - wasm imports are handled by the bundler for workers
import argon2WASM from "argon2-wasm-edge/wasm/argon2.wasm";
// @ts-expect-error - wasm imports are handled by the bundler for workers
import blake2bWASM from "argon2-wasm-edge/wasm/blake2b.wasm";
import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { ulid } from "ulid";

import { getDB } from "$lib/db";
import { mailboxTable, sessionTable, userTable } from "$lib/db/schema";

const encoder = new TextEncoder();
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_COOKIE = "gebna_session";
const argonParams = {
	memorySize: 19456,
	iterations: 3,
	parallelism: 1,
	hashLength: 32,
	outputType: "encoded" as const,
};

const argonReady = setWASMModules({ argon2WASM, blake2bWASM });

const authenticationApp = new Hono<{ Bindings: CloudflareBindings }>();
type AppContext = Context<{ Bindings: CloudflareBindings }>;

authenticationApp.post("/register", async (c) => {
	const bodyValidation = v.safeParse(registerSchema, await c.req.json());
	if (!bodyValidation.success) return c.json({ error: "BAD_REQUEST" }, 400);

	const db = getDB(c.env);
	const existing = await db.query.userTable.findFirst({
		columns: { id: true },
		where: (t, { eq }) => eq(t.username, bodyValidation.output.username),
	});
	if (existing) return c.json({ error: "USERNAME_TAKEN" }, 409);

	const passwordHash = await hashPassword(bodyValidation.output.password);
	const userId = ulid();

	try {
		await db.transaction(async (tx) => {
			const [newUser] = await tx
				.insert(userTable)
				.values({
					id: userId,
					username: bodyValidation.output.username,
					passwordHash,
				})
				.returning();

			await tx.insert(mailboxTable).values([
				{ userId: newUser.id, type: "screener", name: "Screener", id: ulid() },
				{ userId: newUser.id, type: "important", name: "Important", id: ulid() },
				{ userId: newUser.id, type: "news", name: "News", id: ulid() },
				{ userId: newUser.id, type: "transactional", name: "Transactional", id: ulid() },
				{ userId: newUser.id, type: "trash", name: "Trash", id: ulid() },
			]);
		});
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			return c.json({ error: "USERNAME_TAKEN" }, 409);
		}
		throw error;
	}

	await issueSession({
		c,
		db,
		userId,
		userAgent: c.req.header("user-agent"),
		ip: getRequestIp(c),
	});

	return c.json(
		{
			user: { id: userId, username: bodyValidation.output.username },
		},
		201
	);
});

authenticationApp.post("/login", async (c) => {
	const bodyValidation = v.safeParse(loginSchema, await c.req.json());
	if (!bodyValidation.success) return c.json({ error: "BAD_INPUT" }, 400);

	const db = getDB(c.env);
	const user = await db.query.userTable.findFirst({
		where: (t, { eq }) => eq(t.username, bodyValidation.output.username),
	});
	if (!user) return c.json({ error: "UNAUTHORIZED" }, 401);

	const valid = await verifyPassword(bodyValidation.output.password, user.passwordHash);
	if (!valid) return c.json({ error: "UNAUTHORIZED" }, 401);

	await issueSession({
		c,
		db,
		userId: user.id,
		userAgent: c.req.header("user-agent"),
		ip: getRequestIp(c),
	});

	return c.json({
		user: { id: user.id, username: user.username },
	});
});

authenticationApp.post("/logout", async (c) => {
	const token = getCookie(c, SESSION_COOKIE);
	if (!token) {
		clearSessionCookie(c);
		return c.body(null, 204);
	}

	const parsed = parseSessionToken(token);
	if (!parsed) {
		clearSessionCookie(c);
		return c.body(null, 204);
	}

	const db = getDB(c.env);
	const session = await db.query.sessionTable.findFirst({
		where: (t, { eq }) => eq(t.id, parsed.sessionId),
	});

	if (session) {
		const sessionOk = await verifySessionSecret(parsed.secret, session.sessionSecretHash);
		if (sessionOk) {
			await db
				.update(sessionTable)
				.set({ revoked: true, expiresAt: nowSeconds() })
				.where(eq(sessionTable.id, session.id));
		}
	}

	clearSessionCookie(c);
	return c.body(null, 204);
});

async function issueSession({
	c,
	db,
	userId,
	userAgent,
	ip,
}: {
	c: AppContext;
	db: ReturnType<typeof getDB>;
	userId: string;
	userAgent?: string;
	ip?: string;
}): Promise<{ sessionId: string; expiresAt: number }> {
	const now = nowSeconds();
	const sessionId = ulid();
	const sessionToken = createSessionToken(sessionId);
	const secretHash = await hashSessionSecret(sessionToken.secret);
	const expiresAt = now + SESSION_TTL_SECONDS;

	await db.insert(sessionTable).values({
		id: sessionId,
		userId,
		sessionSecretHash: secretHash,
		userAgent,
		ip,
		createdAt: now,
		expiresAt,
	});

	setSessionCookie(c, sessionToken.token);

	return { sessionId, expiresAt };
}

export async function getCurrentSession(
	_bindings: CloudflareBindings,
	db: ReturnType<typeof getDB>,
	cookieSource?: AppContext | Request | null
): Promise<{ userId: string; sessionId: string } | null> {
	let cookieContext: AppContext | null = null;
	if (cookieSource && "req" in (cookieSource as AppContext)) {
		cookieContext = cookieSource as AppContext;
	} else if (cookieSource) {
		cookieContext = { req: { raw: cookieSource } } as unknown as AppContext;
	}

	const token = cookieContext
		? getCookie(cookieContext as unknown as Context, SESSION_COOKIE)
		: null;
	if (!token) return null;

	const parsed = parseSessionToken(token);
	if (!parsed) return null;

	const session = await db.query.sessionTable.findFirst({
		columns: {
			id: true,
			userId: true,
			expiresAt: true,
			revoked: true,
			sessionSecretHash: true,
		},
		where: (t, { eq }) => eq(t.id, parsed.sessionId),
	});

	if (!session) return null;
	if (session.revoked || session.expiresAt <= nowSeconds()) return null;

	const secretOk = await verifySessionSecret(parsed.secret, session.sessionSecretHash);
	if (!secretOk) return null;

	return { userId: session.userId, sessionId: session.id };
}

function getRequestIp(c: AppContext) {
	const cfIp = c.req.header("cf-connecting-ip");
	if (cfIp) return cfIp;
	const forwarded = c.req.header("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0]?.trim() || undefined;
	return undefined;
}

function createSessionToken(sessionId: string) {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	const secret = encodeBase64url(bytes);
	return { token: `${sessionId}.${secret}`, secret };
}

function parseSessionToken(raw: string): { sessionId: string; secret: string } | null {
	const [sessionId, secret] = raw.split(".");
	if (!sessionId || !secret) return null;
	return { sessionId, secret };
}

async function hashPassword(password: string) {
	await argonReady;
	const salt = new Uint8Array(16);
	crypto.getRandomValues(salt);
	return argon2id({
		...argonParams,
		password,
		salt,
	});
}

async function verifyPassword(password: string, hash: string) {
	await argonReady;
	return argon2Verify({ password, hash });
}

async function hashSessionSecret(secret: string) {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
	return encodeBase64url(new Uint8Array(digest));
}

async function verifySessionSecret(secret: string, hash: string) {
	const calculated = await hashSessionSecret(secret);
	return timingSafeEqual(calculated, hash);
}

function timingSafeEqual(a: string, b: string) {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i += 1) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

function setSessionCookie(c: AppContext, token: string) {
	setCookie(c, SESSION_COOKIE, token, {
		path: "/",
		httpOnly: true,
		secure: true,
		sameSite: "Strict",
		maxAge: SESSION_TTL_SECONDS,
	});
}

function clearSessionCookie(c: AppContext) {
	deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true, sameSite: "Strict", httpOnly: true });
}

function nowSeconds() {
	return Math.floor(Date.now() / 1000);
}

function isUniqueConstraintError(error: unknown) {
	return error instanceof Error && /unique/i.test(error.message);
}

export { authenticationApp };
