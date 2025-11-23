import { and, eq, inArray } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { pushSubscriptionTable } from "../../../db/schema";
import { recordDestroy } from "../change-log";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";

export async function handlePushSubscriptionDestroy(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);
	const effectiveAccountId = ensureAccountAccess(c, args.accountId as string | undefined);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const idsArg = args.ids;
	if (!Array.isArray(idsArg)) {
		return ["error", { type: "invalidArguments", description: "ids must be an array" }, tag];
	}
	const ids = idsArg.filter((value): value is string => typeof value === "string" && value.length > 0);
	if (!ids.length) {
		return ["error", { type: "invalidArguments", description: "ids must include at least one string" }, tag];
	}

	const maxObjects = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInSet ?? 128;
	if (ids.length > maxObjects) {
		return [
			"error",
			{
				type: "limitExceeded",
				description: `Cannot destroy more than ${maxObjects} subscriptions at once`,
			},
			tag,
		];
	}

	const oldState = await getAccountState(db, effectiveAccountId, "PushSubscription");
	const destroyed: string[] = [];
	const notDestroyed: Record<string, { type: string; description?: string }> = {};

	const now = new Date();

	await db.transaction(async (tx) => {
		const rows = await tx
			.select({ id: pushSubscriptionTable.id })
			.from(pushSubscriptionTable)
			.where(and(eq(pushSubscriptionTable.accountId, effectiveAccountId), inArray(pushSubscriptionTable.id, ids)));
		const existing = new Set(rows.map((row) => row.id));

		for (const id of ids) {
			if (!existing.has(id)) {
				notDestroyed[id] = { type: "notFound", description: "PushSubscription not found" };
				continue;
			}

			await tx.delete(pushSubscriptionTable).where(eq(pushSubscriptionTable.id, id));
			await recordDestroy(tx, {
				accountId: effectiveAccountId,
				type: "PushSubscription",
				objectId: id,
				now,
			});
			destroyed.push(id);
		}
	});

	const newState = await getAccountState(db, effectiveAccountId, "PushSubscription");

	return [
		"PushSubscription/destroy",
		{
			accountId: effectiveAccountId,
			oldState,
			newState,
			destroyed,
			notDestroyed,
		},
		tag,
	];
}
