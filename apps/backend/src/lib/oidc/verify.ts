import { ISSUER, REQUIRED_SCOPE } from "./constants";
import { verifyJwt } from "./jwt";
import type { AccessTokenPayload } from "./tokens";

export type VerifiedAccessToken = AccessTokenPayload;

export async function verifyAccessToken(
	env: CloudflareBindings,
	token: string
): Promise<VerifiedAccessToken> {
	const { payload } = await verifyJwt<AccessTokenPayload>(env, token);
	validateAccessTokenClaims(payload);
	return payload;
}

function validateAccessTokenClaims(payload: AccessTokenPayload): void {
	const now = Math.floor(Date.now() / 1000);
	if (payload.iss !== ISSUER) {
		throw new Error("Invalid token issuer");
	}
	if (typeof payload.exp !== "number" || payload.exp <= now) {
		throw new Error("Token expired");
	}
	if (
		typeof payload.scope !== "string" ||
		!payload.scope.split(" ").filter((entry) => entry).includes(REQUIRED_SCOPE)
	) {
		throw new Error("Token missing openid scope");
	}
	if (typeof payload.sub !== "string" || !payload.sub) {
		throw new Error("Invalid token subject");
	}
	if (typeof payload.aud !== "string" || !payload.aud) {
		throw new Error("Invalid token audience");
	}
}
