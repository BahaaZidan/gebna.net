import type { SessionCreatedErrorResponse, SessionCreatedSuccessResponse } from "@gebna/types";
import { v } from "@gebna/validation";
import { loginSchema, registerSchema } from "@gebna/validation/auth";
import { decodeBase64url, encodeBase64url } from "@oslojs/encoding";
import { argon2id, argon2Verify, setWASMModules } from "argon2-wasm-edge";
// @ts-expect-error - wasm imports are handled by the bundler for workers
import argon2WASM from "argon2-wasm-edge/wasm/argon2.wasm";
// @ts-expect-error - wasm imports are handled by the bundler for workers
import blake2bWASM from "argon2-wasm-edge/wasm/blake2b.wasm";
import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { ulid } from "ulid";

import { getDB } from "$lib/db";
import { mailboxTable, sessionTable, userTable } from "$lib/db/schema";

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
	sessionId: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ACCESS_TTL_SECONDS = 60 * 60 * 24 * 30;
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
	if (!bodyValidation.success)
		return c.json<SessionCreatedErrorResponse>({ error: "BAD_REQUEST" }, 400);

	const db = getDB(c.env);
	const existing = await db.query.userTable.findFirst({
		columns: { id: true },
		where: (t, { eq }) => eq(t.username, bodyValidation.output.username),
	});
	if (existing) return c.json<SessionCreatedErrorResponse>({ error: "USERNAME_TAKEN" }, 409);

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
			return c.json<SessionCreatedErrorResponse>({ error: "USERNAME_TAKEN" }, 409);
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

	return c.json<SessionCreatedSuccessResponse>(
		{
			user: { id: userId, username: bodyValidation.output.username },
			...tokens,
		},
		201
	);
});

authenticationApp.post("/login", async (c) => {
	const bodyValidation = v.safeParse(loginSchema, await c.req.json());
	if (!bodyValidation.success)
		return c.json<SessionCreatedErrorResponse>({ error: "BAD_REQUEST" }, 400);

	const db = getDB(c.env);
	const user = await db.query.userTable.findFirst({
		where: (t, { eq }) => eq(t.username, bodyValidation.output.username),
	});
	if (!user) return c.json<SessionCreatedErrorResponse>({ error: "UNAUTHORIZED" }, 401);

	const valid = await verifyPassword(bodyValidation.output.password, user.passwordHash);
	if (!valid) return c.json<SessionCreatedErrorResponse>({ error: "UNAUTHORIZED" }, 401);

	const tokens = await issueTokens({
		c,
		db,
		userId: user.id,
		userAgent: c.req.header("user-agent"),
		ip: getRequestIp(c),
	});

	return c.json<SessionCreatedSuccessResponse>({
		user: { id: user.id, username: user.username },
		...tokens,
	});
});

authenticationApp.post("/logout", async (c) => {
	const bearer = getBearer(c);
	if (!bearer) return c.body(null, 204);

	const db = getDB(c.env);
	const session = await getCurrentSession(c.env, db, bearer);
	if (!session) return c.body(null, 204);

	await db
		.update(sessionTable)
		.set({ revoked: true, expiresAt: nowSeconds() })
		.where(eq(sessionTable.id, session.sessionId));

	return c.body(null, 204);
});

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

	const { token: accessToken, exp: accessTokenExpiresAt } = await signAccessToken(
		{
			env: c.env,
			userId,
			sessionId,
		},
		now
	);

	await db.insert(sessionTable).values({
		id: sessionId,
		userId,
		refreshHash: "unused",
		userAgent,
		ip,
		createdAt: now,
		expiresAt: accessTokenExpiresAt,
	});

	return {
		accessToken,
		accessTokenExpiresAt,
		sessionId,
	};
}

export async function getCurrentSession(
	bindings: CloudflareBindings,
	db: ReturnType<typeof getDB>,
	bearer?: string | null
): Promise<{ userId: string; sessionId: string } | null> {
	if (!bearer) return null;

	let payload: JwtPayload;
	try {
		payload = await verifyJwt(bearer, bindings.JWT_SECRET);
	} catch {
		return null;
	}

	if (
		payload.exp <= nowSeconds() ||
		payload.typ !== "access" ||
		payload.iss !== bindings.BASE_API_URL ||
		(payload.aud && payload.aud !== "api")
	)
		return null;

	const session = await db.query.sessionTable.findFirst({
		columns: {
			id: true,
			userId: true,
			expiresAt: true,
			revoked: true,
		},
		where: (t, { eq }) => eq(t.id, payload.sid),
	});

	if (!session) return null;
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
		token: await signJwt(payload, input.env.JWT_SECRET),
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
	const signatureBytes = decodeBase64url(sigB64);
	const signatureBuffer = new Uint8Array(signatureBytes).buffer;
	const ok = await crypto.subtle.verify("HMAC", key, signatureBuffer, encoder.encode(data));
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
			crypto.subtle.importKey(
				"raw",
				encoder.encode(secret),
				{ name: "HMAC", hash: "SHA-256" },
				false,
				["sign", "verify"]
			)
		);
	}
	return keyCache.get(secret)!;
}

function nowSeconds() {
	return Math.floor(Date.now() / 1000);
}

function isUniqueConstraintError(error: unknown) {
	return error instanceof Error && /unique/i.test(error.message);
}

export { authenticationApp };
