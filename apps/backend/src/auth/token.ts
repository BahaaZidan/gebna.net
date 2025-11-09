import { sign as jwtSign } from "hono/jwt";

import { nowSec } from "./crypto";

export const ACCESS_TTL = 60 * 10;
export const REFRESH_TTL = 60 * 60 * 24 * 60;

export async function signAccessJWT(env: CloudflareBindings, sub: string, sid: string) {
	const now = nowSec();
	return jwtSign(
		{ sub, sid, iat: now, nbf: now - 5, exp: now + ACCESS_TTL },
		env.JWT_SECRET,
		"HS256"
	);
}
