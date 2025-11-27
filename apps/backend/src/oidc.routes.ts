import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import type { MiddlewareHandler } from "hono";
import { type JwtVariables, verify as verifyJwt } from "hono/jwt";

import { getDB } from "./db";
import { oidcAuthCodeTable } from "./db/schema";
import { loadUserWithPrimaryAccount } from "./lib/auth/session";
import {
	AUTHORIZATION_CODE_TTL_SECONDS,
	SUPPORTED_CODE_CHALLENGE_METHODS,
	SUPPORTED_RESPONSE_TYPES,
	TOKEN_TYPE,
} from "./lib/oidc/constants";
import { buildDiscoveryDocument } from "./lib/oidc/discovery";
import { findClientById } from "./lib/oidc/clients";
import { ensureScopesAllowed, parseScope } from "./lib/oidc/scopes";
import { verifyPkceS256 } from "./lib/oidc/pkce";
import { timingSafeEqualString } from "./lib/oidc/encoding";
import { issueAccessToken, issueIdToken } from "./lib/oidc/tokens";
import { buildPublicJwksResponse } from "./lib/oidc/jwks";
import { verifyAccessToken } from "./lib/oidc/verify";
import { buildWebFingerResponse, OPENID_ISSUER_REL } from "./lib/oidc/webfinger";
import type { OidcClient } from "./lib/oidc/clients";

type OidcVariables = JwtVariables & {
	sessionUser?: {
		id: string;
		username: string;
	};
	sessionAccount?: {
		id: string;
		address: string;
	};
};

export const oidcApp = new Hono<{ Bindings: CloudflareBindings; Variables: OidcVariables }>();

const requireSessionUser: MiddlewareHandler<{ Bindings: CloudflareBindings; Variables: OidcVariables }> = async (
	c,
	next
) => {
	const header = c.req.header("Authorization");
	if (!header?.startsWith("Bearer ")) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	const token = header.slice("Bearer ".length).trim();
	let payload;
	try {
		payload = await verifyJwt(token, c.env.JWT_SECRET, "HS256");
	} catch {
		return c.json({ error: "Unauthorized" }, 401);
	}
	if (!payload || typeof payload.sub !== "string") {
		return c.json({ error: "Unauthorized" }, 401);
	}
	const pair = await loadUserWithPrimaryAccount(c.env, payload.sub);
	if (!pair) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	c.set("jwtPayload", payload);
	c.set("sessionUser", pair.user);
	c.set("sessionAccount", pair.account);
	return next();
};

oidcApp.get("/.well-known/openid-configuration", (c) => c.json(buildDiscoveryDocument()));

oidcApp.get("/oauth2/jwks.json", (c) => c.json(buildPublicJwksResponse(c.env)));

oidcApp.get("/.well-known/webfinger", (c) => {
	const url = new URL(c.req.url);
	const resource = url.searchParams.get("resource");
	const rel = url.searchParams.getAll("rel");
	if (!resource) {
		return c.json({ error: "resource parameter is required" }, 400);
	}
	if (!rel.includes(OPENID_ISSUER_REL)) {
		return c.json({ error: "relation not supported" }, 404);
	}
	return c.json(buildWebFingerResponse(resource));
});

oidcApp.get("/oauth2/authorize", requireSessionUser, async (c) => {
	const url = new URL(c.req.url);
	const responseType = url.searchParams.get("response_type");
	if (responseType !== SUPPORTED_RESPONSE_TYPES[0]) {
		return c.json({ error: "unsupported_response_type" }, 400);
	}

	const clientId = url.searchParams.get("client_id");
	const redirectUri = url.searchParams.get("redirect_uri");
	const scopeParam = url.searchParams.get("scope") ?? "";
	const state = url.searchParams.get("state") ?? undefined;
	const codeChallenge = url.searchParams.get("code_challenge");
	const codeChallengeMethod = url.searchParams.get("code_challenge_method") ?? "S256";
	const nonce = url.searchParams.get("nonce");

	if (!clientId) return c.json({ error: "invalid_request", error_description: "client_id required" }, 400);
	if (!redirectUri) {
		return c.json({ error: "invalid_request", error_description: "redirect_uri required" }, 400);
	}
	const db = getDB(c.env);
	const client = await findClientById(db, clientId);
	if (!client) {
		return c.json({ error: "unauthorized_client" }, 400);
	}
	if (!isRedirectUriAllowed(redirectUri, client)) {
		return c.json({ error: "invalid_request", error_description: "redirect_uri mismatch" }, 400);
	}

	if (!codeChallenge || !isValidCodeChallenge(codeChallenge)) {
		return authorizationError(c, redirectUri, state, "invalid_request", "code_challenge invalid");
	}
	if (!SUPPORTED_CODE_CHALLENGE_METHODS.includes(codeChallengeMethod as (typeof SUPPORTED_CODE_CHALLENGE_METHODS)[number])) {
		return authorizationError(c, redirectUri, state, "invalid_request", "Only S256 PKCE is supported");
	}

	const scopes = parseScope(scopeParam);
	if (!scopes.length) {
		return authorizationError(c, redirectUri, state, "invalid_scope", "scope must be provided");
	}

	try {
		ensureScopesAllowed(scopes, client);
	} catch (error) {
		return authorizationError(
			c,
			redirectUri,
			state,
			"invalid_scope",
			error instanceof Error ? error.message : "invalid scope"
		);
	}

	const code = await persistAuthorizationCode({
		db,
		client,
		redirectUri,
		scope: scopes.join(" "),
		codeChallenge,
		codeChallengeMethod,
		nonce: nonce ?? null,
		userId: c.get("sessionUser")!.id,
	});

	return c.redirect(buildRedirectUrl(redirectUri, { code, state }), 302);
});

oidcApp.post("/oauth2/token", async (c) => {
	const contentType = c.req.header("content-type") ?? "";
	if (!contentType.includes("application/x-www-form-urlencoded")) {
		return c.json({ error: "invalid_request", error_description: "Form data required" }, 400);
	}
	const form = await c.req.parseBody();
	const grantType = getFormValue(form, "grant_type");
	if (grantType !== "authorization_code") {
		return c.json({ error: "unsupported_grant_type" }, 400);
	}
	const rawCode = getFormValue(form, "code");
	const redirectUri = getFormValue(form, "redirect_uri");
	const codeVerifier = getFormValue(form, "code_verifier");
	if (!rawCode || !redirectUri || !codeVerifier) {
		return c.json({ error: "invalid_request", error_description: "code, redirect_uri and code_verifier required" }, 400);
	}
	if (!isValidCodeVerifier(codeVerifier)) {
		return c.json({ error: "invalid_request", error_description: "Invalid code_verifier" }, 400);
	}

	const db = getDB(c.env);
	const authHeader = c.req.header("Authorization");
	const basicAuth = parseBasicAuth(authHeader);
	const clientId = basicAuth?.clientId ?? getFormValue(form, "client_id");
	if (!clientId) {
		return c.json({ error: "invalid_client", error_description: "client authentication required" }, 401);
	}
	const client = await findClientById(db, clientId);
	if (!client) {
		return c.json({ error: "invalid_client" }, 401);
	}

	if (client.isConfidential) {
		const candidate = basicAuth?.clientSecret ?? getFormValue(form, "client_secret");
		if (!candidate || !client.clientSecret) {
			return c.json({ error: "invalid_client", error_description: "client_secret required" }, 401);
		}
		if (!timingSafeEqualString(candidate, client.clientSecret)) {
			return c.json({ error: "invalid_client", error_description: "client_secret mismatch" }, 401);
		}
	}

	const codeRow = await db.query.oidcAuthCodeTable.findFirst({
		where: (table, { eq }) => eq(table.code, rawCode),
	});
	if (!codeRow) {
		return c.json({ error: "invalid_grant", error_description: "Authorization code not found" }, 400);
	}
	if (codeRow.clientId !== client.id) {
		return c.json({ error: "invalid_grant", error_description: "client mismatch" }, 400);
	}
	if (codeRow.redirectUri !== redirectUri) {
		return c.json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
	}
	if (codeRow.expiresAt <= new Date()) {
		return c.json({ error: "invalid_grant", error_description: "Authorization code expired" }, 400);
	}
	if (codeRow.codeChallengeMethod !== "S256") {
		return c.json({ error: "invalid_grant", error_description: "Unsupported PKCE method" }, 400);
	}
	if (!(await verifyPkceS256(codeVerifier, codeRow.codeChallenge))) {
		return c.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
	}

	const deleteResult = await db.delete(oidcAuthCodeTable).where(eq(oidcAuthCodeTable.code, codeRow.code));
	if ((deleteResult.rowsAffected ?? 0) === 0) {
		return c.json({ error: "invalid_grant", error_description: "Authorization code already used" }, 400);
	}

	const userPair = await loadUserWithPrimaryAccount(c.env, codeRow.userId);
	if (!userPair) {
		return c.json({ error: "server_error" }, 500);
	}

	const access = await issueAccessToken({
		env: c.env,
		db,
		userId: codeRow.userId,
		clientId: client.id,
		scope: codeRow.scope,
	});
	const idToken = await issueIdToken({
		env: c.env,
		db,
		userId: codeRow.userId,
		clientId: client.id,
		scope: codeRow.scope,
		username: userPair.user.username,
		email: userPair.account.address,
		emailVerified: true,
		nonce: codeRow.nonce,
	});

	return c.json({
		access_token: access.token,
		id_token: idToken.token,
		token_type: TOKEN_TYPE,
		expires_in: access.expiresIn,
		scope: codeRow.scope,
	});
});

oidcApp.get("/oauth2/userinfo", async (c) => {
	const header = c.req.header("Authorization");
	if (!header?.startsWith("Bearer ")) {
		return c.json({ error: "invalid_token" }, 401);
	}
	const token = header.slice("Bearer ".length).trim();
	let payload;
	try {
		payload = await verifyAccessToken(c.env, token);
	} catch (error) {
		return c.json({ error: "invalid_token", error_description: error instanceof Error ? error.message : "invalid" }, 401);
	}
	const scopes = payload.scope.split(" ").filter((entry) => entry);
	const userPair = await loadUserWithPrimaryAccount(c.env, payload.sub);
	if (!userPair) {
		return c.json({ error: "invalid_token" }, 401);
	}
	const response: Record<string, unknown> = {
		sub: userPair.user.id,
	};
	if (scopes.includes("email")) {
		response.email = userPair.account.address;
		response.email_verified = true;
	}
	if (scopes.includes("profile")) {
		response.preferred_username = userPair.user.username;
	}
	return c.json(response);
});

function authorizationError(
	c: Context<{ Bindings: CloudflareBindings; Variables: OidcVariables }>,
	redirectUri: string,
	state: string | undefined,
	error: string,
	description: string
) {
	return c.redirect(
		buildRedirectUrl(redirectUri, {
			error,
			error_description: description,
			state,
		})
	);
}

async function persistAuthorizationCode(options: {
	db: ReturnType<typeof getDB>;
	client: OidcClient;
	userId: string;
	redirectUri: string;
	scope: string;
	codeChallenge: string;
	codeChallengeMethod: string;
	nonce: string | null;
}) {
	const code = generateRandomCode();
	const now = new Date();
	await options.db.insert(oidcAuthCodeTable).values({
		code,
		clientId: options.client.id,
		userId: options.userId,
		redirectUri: options.redirectUri,
		scope: options.scope,
		codeChallenge: options.codeChallenge,
		codeChallengeMethod: options.codeChallengeMethod,
		nonce: options.nonce,
		createdAt: now,
		expiresAt: new Date(now.getTime() + AUTHORIZATION_CODE_TTL_SECONDS * 1000),
	});
	return code;
}

function isValidCodeChallenge(value: string): boolean {
	return /^[A-Za-z0-9\-_]{43,128}$/.test(value);
}

const isValidCodeVerifier = isValidCodeChallenge;

function parseBasicAuth(header?: string | null) {
	if (!header || !header.startsWith("Basic ")) return null;
	const decoded = atob(header.slice("Basic ".length));
	const [clientId, clientSecret] = decoded.split(":", 2);
	if (!clientId) return null;
	return { clientId, clientSecret };
}

function getFormValue(form: Record<string, unknown>, key: string): string | undefined {
	const value = form[key];
	return typeof value === "string" ? value : undefined;
}

function isRedirectUriAllowed(uri: string, client: OidcClient): boolean {
	try {
		// Ensure URI is absolute before accepting it.
		new URL(uri);
	} catch {
		return false;
	}
	return client.redirectUris.includes(uri);
}

function buildRedirectUrl(
	redirectUri: string,
	params: Record<string, string | undefined>
): string {
	const target = new URL(redirectUri);
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null) {
			target.searchParams.set(key, value);
		}
	});
	return target.toString();
}

function generateRandomCode(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	const base64 = btoa(String.fromCharCode(...bytes));
	return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
