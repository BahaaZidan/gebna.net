import { v } from "@gebna/validation";
import { loginSchema, registerSchema } from "@gebna/validation/auth";
import { encodeBase64url, decodeBase64url } from "@oslojs/encoding";
import { argon2Verify, argon2id, setWASMModules } from "argon2-wasm-edge";
// @ts-expect-error - wasm imports are handled by the bundler for workers
import argon2WASM from "argon2-wasm-edge/wasm/argon2.wasm";
// @ts-expect-error - wasm imports are handled by the bundler for workers
import blake2bWASM from "argon2-wasm-edge/wasm/blake2b.wasm";
import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { ulid } from "ulid";

import { getDB, schema } from "../db";

type JwtPayload = {
	sub: string;
	sid: string;
	iss: string;
	aud?: string;
	typ: "access";
	iat: number;
	exp: number;
};

type TokenBundle = {
	accessToken: string;
	accessTokenExpiresAt: number;
	refreshToken: string;
	refreshTokenExpiresAt: number;
	sessionId: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;
const argonParams = {
	memorySize: 19456,
	iterations: 3,
	parallelism: 1,
	hashLength: 32,
	outputType: "encoded" as const,
};

const refreshSchema = v.object({
	refreshToken: v.pipe(v.string(), v.minLength(40), v.maxLength(256)),
});

const argonReady = setWASMModules({ argon2WASM, blake2bWASM });

const authenticationApp = new Hono<{ Bindings: CloudflareBindings }>();
type AppContext = Context<{ Bindings: CloudflareBindings }>;

authenticationApp.post("/register", async (c) => {
	const parsed = await readBody(c, registerSchema);
	if (!parsed.ok) return parsed.res;

	const db = getDB(c.env);
	const existing = await db
		.select({ id: schema.userTable.id })
		.from(schema.userTable)
		.where(eq(schema.userTable.username, parsed.data.username))
		.limit(1);
	if (existing.length > 0) {
		return c.json({ error: "USERNAME_TAKEN" }, 409);
	}

	const passwordHash = await hashPassword(parsed.data.password);
	const userId = ulid();

	try {
		await db.insert(schema.userTable).values({
			id: userId,
			username: parsed.data.username,
			passwordHash,
		});
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			return c.json({ error: "USERNAME_TAKEN" }, 409);
		}
		throw error;
	}

	const tokens = await issueTokens({
		c,
		db,
		userId,
		userAgent: c.req.header("user-agent"),
		ip: getRequestIp(c),
	});

	return c.json(
		{
			user: { id: userId, username: parsed.data.username },
			...tokens,
		},
		201
	);
});

authenticationApp.post("/login", async (c) => {
	const parsed = await readBody(c, loginSchema);
	if (!parsed.ok) return parsed.res;

	const db = getDB(c.env);
	const user = await db
		.select({
			id: schema.userTable.id,
			username: schema.userTable.username,
			passwordHash: schema.userTable.passwordHash,
		})
		.from(schema.userTable)
		.where(eq(schema.userTable.username, parsed.data.username))
		.limit(1);

	if (user.length === 0) {
		return unauthorized(c);
	}

	const valid = await verifyPassword(parsed.data.password, user[0].passwordHash);
	if (!valid) {
		return unauthorized(c);
	}

	const tokens = await issueTokens({
		c,
		db,
		userId: user[0].id,
		userAgent: c.req.header("user-agent"),
		ip: getRequestIp(c),
	});

	return c.json({
		user: { id: user[0].id, username: user[0].username },
		...tokens,
	});
});

authenticationApp.post("/refresh", async (c) => {
	const bearer = getBearer(c);
	const parsedBody = bearer ? null : await readBody(c, refreshSchema);
	if (!bearer && !parsedBody?.ok) return parsedBody!.res;

	const rawRefresh = bearer ?? (parsedBody?.ok ? parsedBody.data.refreshToken : null);
	if (!rawRefresh) return unauthorized(c);

	const parsed = parseRefreshToken(rawRefresh);
	if (!parsed) return unauthorized(c);

	const db = getDB(c.env);
	const sessionRows = await db
		.select()
		.from(schema.sessionTable)
		.where(eq(schema.sessionTable.id, parsed.sessionId))
		.limit(1);
	if (sessionRows.length === 0) return unauthorized(c);

	const session = sessionRows[0];
	if (session.revoked || session.expiresAt <= nowSeconds()) return unauthorized(c);

	const refreshOk = await verifyRefreshSecret(parsed.secret, session.refreshHash);
	if (!refreshOk) return unauthorized(c);

	const userRows = await db
		.select({ id: schema.userTable.id, username: schema.userTable.username })
		.from(schema.userTable)
		.where(eq(schema.userTable.id, session.userId))
		.limit(1);
	if (userRows.length === 0) return unauthorized(c);

	const tokens = await rotateTokens({
		c,
		db,
		sessionId: session.id,
		userId: session.userId,
		userAgent: c.req.header("user-agent"),
		ip: getRequestIp(c),
	});

	return c.json({
		user: userRows[0],
		...tokens,
	});
});

authenticationApp.post("/logout", async (c) => {
	const bearer = getBearer(c);
	const parsedBody = bearer ? null : await readBody(c, refreshSchema);
	const rawRefresh = bearer ?? (parsedBody?.ok ? parsedBody.data.refreshToken : null);
	if (!rawRefresh) return c.body(null, 204);

	const parsed = parseRefreshToken(rawRefresh);
	if (!parsed) return c.body(null, 204);

	const db = getDB(c.env);
	const sessionRows = await db
		.select()
		.from(schema.sessionTable)
		.where(eq(schema.sessionTable.id, parsed.sessionId))
		.limit(1);
	if (sessionRows.length === 0) return c.body(null, 204);

	const session = sessionRows[0];
	const refreshOk = await verifyRefreshSecret(parsed.secret, session.refreshHash);
	if (refreshOk) {
		await db
			.update(schema.sessionTable)
			.set({ revoked: true, expiresAt: nowSeconds() })
			.where(eq(schema.sessionTable.id, session.id));
	}

	return c.body(null, 204);
});

authenticationApp.get("/me", async (c) => {
	const db = getDB(c.env);
	const auth = await authenticateAccess(c, db);
	if (!auth) return unauthorized(c);

	const userRows = await db
		.select({ id: schema.userTable.id, username: schema.userTable.username })
		.from(schema.userTable)
		.where(eq(schema.userTable.id, auth.userId))
		.limit(1);
	if (userRows.length === 0) return unauthorized(c);

	return c.json({
		user: userRows[0],
		sessionId: auth.sessionId,
	});
});

async function readBody<
	TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>
>(
	c: AppContext,
	schema: TSchema
): Promise<
	{ ok: true; data: v.InferOutput<TSchema> } | { ok: false; res: Response }
> {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return { ok: false, res: c.json({ error: "INVALID_JSON" }, 400) };
	}

	const parsed = v.safeParse(schema, body);
	if (!parsed.success) {
		return {
			ok: false,
			res: c.json({ error: "INVALID_INPUT", issues: parsed.issues }, 400),
		};
	}

	return { ok: true, data: parsed.output };
}

async function issueTokens({
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
}): Promise<TokenBundle> {
	const now = nowSeconds();
	const sessionId = ulid();
	const refresh = createRefreshToken(sessionId);
	const refreshHash = await hashRefreshSecret(refresh.secret);
	const refreshExpiresAt = now + REFRESH_TTL_SECONDS;

	await db.insert(schema.sessionTable).values({
		id: sessionId,
		userId,
		refreshHash,
		userAgent,
		ip,
		createdAt: now,
		expiresAt: refreshExpiresAt,
	});

	const { token: accessToken, exp: accessTokenExpiresAt } = await signAccessToken(
		{
			env: c.env,
			userId,
			sessionId,
		},
		now
	);

	return {
		accessToken,
		accessTokenExpiresAt,
		refreshToken: refresh.token,
		refreshTokenExpiresAt: refreshExpiresAt,
		sessionId,
	};
}

async function rotateTokens({
	c,
	db,
	sessionId,
	userId,
	userAgent,
	ip,
}: {
	c: AppContext;
	db: ReturnType<typeof getDB>;
	sessionId: string;
	userId: string;
	userAgent?: string;
	ip?: string;
}): Promise<TokenBundle> {
	const now = nowSeconds();
	const refresh = createRefreshToken(sessionId);
	const refreshHash = await hashRefreshSecret(refresh.secret);
	const refreshExpiresAt = now + REFRESH_TTL_SECONDS;

	await db
		.update(schema.sessionTable)
		.set({
			refreshHash,
			expiresAt: refreshExpiresAt,
			userAgent,
			ip,
			revoked: false,
		})
		.where(eq(schema.sessionTable.id, sessionId));

	const { token: accessToken, exp: accessTokenExpiresAt } = await signAccessToken(
		{
			env: c.env,
			userId,
			sessionId,
		},
		now
	);

	return {
		accessToken,
		accessTokenExpiresAt,
		refreshToken: refresh.token,
		refreshTokenExpiresAt: refreshExpiresAt,
		sessionId,
	};
}

async function authenticateAccess(
	c: AppContext,
	db: ReturnType<typeof getDB>
): Promise<{ userId: string; sessionId: string } | null> {
	const bearer = getBearer(c);
	if (!bearer) return null;

	let payload: JwtPayload;
	try {
		payload = await verifyJwt(bearer, getJwtSecret(c.env));
	} catch {
		return null;
	}

	if (
		payload.exp <= nowSeconds() ||
		payload.typ !== "access" ||
		payload.iss !== c.env.BASE_API_URL ||
		(payload.aud && payload.aud !== "api")
	)
		return null;

	const sessionRows = await db
		.select({
			id: schema.sessionTable.id,
			userId: schema.sessionTable.userId,
			expiresAt: schema.sessionTable.expiresAt,
			revoked: schema.sessionTable.revoked,
		})
		.from(schema.sessionTable)
		.where(eq(schema.sessionTable.id, payload.sid))
		.limit(1);

	if (sessionRows.length === 0) return null;
	const session = sessionRows[0];

	if (session.revoked || session.expiresAt <= nowSeconds()) return null;
	if (session.userId !== payload.sub) return null;

	return { userId: payload.sub, sessionId: payload.sid };
}

function getBearer(c: AppContext) {
	const header = c.req.header("authorization") || c.req.header("Authorization");
	if (!header || !header.toLowerCase().startsWith("bearer ")) return null;
	return header.slice(7).trim();
}

function getRequestIp(c: AppContext) {
	const cfIp = c.req.header("cf-connecting-ip");
	if (cfIp) return cfIp;
	const forwarded = c.req.header("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0]?.trim() || undefined;
	return undefined;
}

function createRefreshToken(sessionId: string) {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	const secret = encodeBase64url(bytes);
	return { token: `${sessionId}.${secret}`, secret };
}

function parseRefreshToken(raw: string): { sessionId: string; secret: string } | null {
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

async function hashRefreshSecret(secret: string) {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
	return encodeBase64url(new Uint8Array(digest));
}

async function verifyRefreshSecret(secret: string, hash: string) {
	const calculated = await hashRefreshSecret(secret);
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

async function signAccessToken(
	input: { env: CloudflareBindings; userId: string; sessionId: string },
	now: number
): Promise<{ token: string; exp: number }> {
	const exp = now + ACCESS_TTL_SECONDS;
	const payload: JwtPayload = {
		sub: input.userId,
		sid: input.sessionId,
		iss: input.env.BASE_API_URL,
		aud: "api",
		typ: "access",
		iat: now,
		exp,
	};

	return {
		token: await signJwt(payload, getJwtSecret(input.env)),
		exp,
	};
}

async function signJwt(payload: JwtPayload, secret: string) {
	const header = { alg: "HS256", typ: "JWT" };
	const encodedHeader = encodeBase64url(encoder.encode(JSON.stringify(header)));
	const encodedPayload = encodeBase64url(encoder.encode(JSON.stringify(payload)));
	const data = `${encodedHeader}.${encodedPayload}`;
	const key = await getSigningKey(secret);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
	return `${data}.${encodeBase64url(new Uint8Array(signature))}`;
}

async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
	const parts = token.split(".");
	if (parts.length !== 3) throw new Error("INVALID_TOKEN");
	const [headerB64, payloadB64, sigB64] = parts;
	const data = `${headerB64}.${payloadB64}`;

	const key = await getSigningKey(secret);
	const signature = decodeBase64url(sigB64);
	const ok = await crypto.subtle.verify("HMAC", key, signature, encoder.encode(data));
	if (!ok) throw new Error("INVALID_SIGNATURE");

	const payloadJson = decoder.decode(decodeBase64url(payloadB64));
	const payload = JSON.parse(payloadJson) as JwtPayload;
	if (
		payload.typ !== "access" ||
		typeof payload.sub !== "string" ||
		typeof payload.sid !== "string" ||
		typeof payload.iss !== "string" ||
		typeof payload.exp !== "number" ||
		typeof payload.iat !== "number"
	) {
		throw new Error("INVALID_TYPE");
	}
	return payload;
}

const keyCache = new Map<string, Promise<CryptoKey>>();
function getSigningKey(secret: string) {
	if (!keyCache.has(secret)) {
		keyCache.set(
			secret,
			crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
				"sign",
				"verify",
			])
		);
	}
	return keyCache.get(secret)!;
}

function getJwtSecret(env: CloudflareBindings) {
	const secret =
		(env as unknown as { JWT_SECRET?: string; JWT_SIGNING_SECRET?: string }).JWT_SECRET ||
		(env as unknown as { JWT_SIGNING_SECRET?: string }).JWT_SIGNING_SECRET;

	if (!secret || secret.length < 16) {
		throw new Error("JWT secret is not configured or too short");
	}

	return secret;
}

function nowSeconds() {
	return Math.floor(Date.now() / 1000);
}

function unauthorized(c: AppContext): Response {
	return c.json({ error: "INVALID_CREDENTIALS" }, 401);
}

function isUniqueConstraintError(error: unknown) {
	return error instanceof Error && /unique/i.test(error.message);
}

export { authenticationApp };
