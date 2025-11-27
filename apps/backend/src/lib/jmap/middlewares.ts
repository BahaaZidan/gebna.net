import type { MiddlewareHandler } from "hono";
import { type JwtVariables, verify as verifyJwt } from "hono/jwt";

import { userTable } from "../../db/schema";
import { loadUserWithPrimaryAccount } from "../auth/session";
import { verifyAccessToken } from "../oidc/verify";
import type { CreationReferenceMap } from "./types";

export type JMAPHonoAppEnv = {
	Bindings: CloudflareBindings;
	Variables: JwtVariables & {
		user: typeof userTable.$inferSelect;
		accountId: string;
		creationReferences?: CreationReferenceMap;
		requestProperties?: Record<string, unknown>;
	};
};

export const requireJWT: MiddlewareHandler<JMAPHonoAppEnv> = async (c, next) => {
	const header = c.req.header("Authorization");
	if (!header?.startsWith("Bearer ")) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	const token = header.slice("Bearer ".length).trim();

	const legacyPayload = await verifyLegacyJwt(c.env, token);
	if (legacyPayload) {
		c.set("jwtPayload", legacyPayload);
		return next();
	}

	const oidcPayload = await verifyOidcBearer(c.env, token);
	if (oidcPayload) {
		c.set("jwtPayload", oidcPayload);
		return next();
	}

	return c.json({ error: "Unauthorized" }, 401);
};

export const attachUserFromJwt: MiddlewareHandler<JMAPHonoAppEnv> = async (c, next) => {
	const payload = c.get("jwtPayload");

	if (!payload || typeof payload.sub !== "string") return c.json({ error: "Unauthorized" }, 401);

	const pair = await loadUserWithPrimaryAccount(c.env, payload.sub);
	if (!pair) return c.json({ error: "Unauthorized" }, 401);
	c.set("user", pair.user);
	c.set("accountId", pair.account.id);
	await next();
};

async function verifyLegacyJwt(env: CloudflareBindings, token: string) {
	try {
		return await verifyJwt(token, env.JWT_SECRET, "HS256");
	} catch {
		return null;
	}
}

async function verifyOidcBearer(env: CloudflareBindings, token: string) {
	try {
		const payload = await verifyAccessToken(env, token);
		const scopes = payload.scope.split(" ").filter((entry) => entry);
		if (!scopes.includes("jmap")) {
			return null;
		}
		return payload;
	} catch {
		return null;
	}
}
