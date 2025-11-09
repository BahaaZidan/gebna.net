import { bearerAuth } from "hono/bearer-auth";
import { jwt } from "hono/jwt";

import { getDB } from "../db";
import { hmacRefresh, nowSec } from "./crypto";

export const requireRefreshBearer = bearerAuth({
	realm: "api",
	invalidTokenMessage: { error: "invalid/expired" },
	verifyToken: async (token, c) => {
		if (!token) return false;
		const hash = await hmacRefresh(c.env, token);
		const db = getDB(c.env);
		const row = await db.query.sessionTable.findFirst({
			where: (t, { and, eq, gt }) =>
				and(eq(t.refreshHash, hash), eq(t.revoked, false), gt(t.expiresAt, nowSec())),
		});
		if (row) c.set("sessionRow", row);
		return !!row;
	},
});
