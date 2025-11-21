import { and, eq, gt, lt, sql } from "drizzle-orm";

import { getDB } from "../../db";
import { authRateLimitTable } from "../../db/schema";

type RateLimitOptions = {
	key: string;
	route: string;
	windowMs: number;
	max: number;
	now?: Date;
	cleanupMs?: number;
};

export async function consumeRateLimit(
	db: ReturnType<typeof getDB>,
	options: RateLimitOptions
): Promise<boolean> {
	const now = options.now ?? new Date();
	const windowStart = new Date(now.getTime() - options.windowMs);

	const [{ count } = { count: 0 }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(authRateLimitTable)
		.where(
			and(
				eq(authRateLimitTable.key, options.key),
				eq(authRateLimitTable.route, options.route),
				gt(authRateLimitTable.createdAt, windowStart)
			)
		);

	if ((count ?? 0) >= options.max) {
		return false;
	}

	await db.insert(authRateLimitTable).values({
		id: crypto.randomUUID(),
		key: options.key,
		route: options.route,
		createdAt: now,
	});

	const cleanupMs = options.cleanupMs ?? options.windowMs * 10;
	const cutoff = new Date(now.getTime() - cleanupMs);
	await db.delete(authRateLimitTable).where(lt(authRateLimitTable.createdAt, cutoff));

	return true;
}
