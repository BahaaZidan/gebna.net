import { oidcTokenTable } from "../../db/schema";
import type { DBInstance } from "../../db";
import { ACCESS_TOKEN_TTL_SECONDS, ID_TOKEN_TTL_SECONDS, ISSUER, TOKEN_TYPE } from "./constants";
import { signJwt } from "./jwt";

type AccessTokenParams = {
	env: CloudflareBindings;
	db: DBInstance;
	userId: string;
	clientId: string;
	scope: string;
};

type IdTokenParams = {
	env: CloudflareBindings;
	db: DBInstance;
	userId: string;
	clientId: string;
	scope: string;
	username: string;
	email: string;
	emailVerified: boolean;
	nonce?: string | null;
};

export type AccessTokenPayload = {
	iss: string;
	sub: string;
	aud: string;
	scope: string;
	iat: number;
	exp: number;
	jti: string;
	token_type: string;
};

export type IdTokenPayload = {
	iss: string;
	sub: string;
	aud: string;
	iat: number;
	exp: number;
	nonce?: string;
	email: string;
	email_verified: boolean;
	preferred_username: string;
	jti: string;
};

export async function issueAccessToken(params: AccessTokenParams) {
	const now = Math.floor(Date.now() / 1000);
	const exp = now + ACCESS_TOKEN_TTL_SECONDS;
	const jti = crypto.randomUUID();
	const payload: AccessTokenPayload = {
		iss: ISSUER,
		sub: params.userId,
		aud: params.clientId,
		scope: params.scope,
		iat: now,
		exp,
		jti,
		token_type: TOKEN_TYPE,
	};
	const token = await signJwt(params.env, payload);
	const nowDate = new Date();
	await params.db.insert(oidcTokenTable).values({
		id: jti,
		clientId: params.clientId,
		userId: params.userId,
		scope: params.scope,
		type: "access",
		expiresAt: new Date(exp * 1000),
		createdAt: nowDate,
	});
	return { token, payload, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export async function issueIdToken(params: IdTokenParams) {
	const now = Math.floor(Date.now() / 1000);
	const exp = now + ID_TOKEN_TTL_SECONDS;
	const jti = crypto.randomUUID();
	const payload: IdTokenPayload = {
		iss: ISSUER,
		sub: params.userId,
		aud: params.clientId,
		iat: now,
		exp,
		email: params.email,
		email_verified: params.emailVerified,
		preferred_username: params.username,
		jti,
	};
	if (params.nonce) {
		payload.nonce = params.nonce;
	}
	const token = await signJwt(params.env, payload);
	const nowDate = new Date();
	await params.db.insert(oidcTokenTable).values({
		id: jti,
		clientId: params.clientId,
		userId: params.userId,
		scope: params.scope,
		type: "id",
		expiresAt: new Date(exp * 1000),
		createdAt: nowDate,
	});
	return { token, payload };
}
