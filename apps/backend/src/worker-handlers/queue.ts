import { getRandom } from "@cloudflare/containers";
import { eq } from "drizzle-orm";

import { DBInstance, getDB } from "$lib/db";
import { identityTable } from "$lib/db/schema";
import type {
	InferAddressAvatarQueueMessage,
	QueueMessage,
	ThumbnailQueueMessage,
} from "$lib/queue/types";
import { resolveAvatar } from "$lib/utils/email";

export async function queueHandler(
	batch: MessageBatch<QueueMessage>,
	env: CloudflareBindings,
	ctx: ExecutionContext
) {
	const db = getDB(env);

	const tasks = batch.messages.map((message) =>
		(async () => {
			try {
				switch (message.body.type) {
					case "infer-address-avatar":
						return await processAddressAvatarMessage(db, message.body);
					case "thumbnail":
						return await processThumbnailMessage(env, message.body);
					default:
						return;
				}
			} catch (error) {
				console.error("queue processing failed", error);
				message.retry({ delaySeconds: 30 });
			}
		})()
	);

	const all = Promise.all(tasks);
	ctx.waitUntil(all);
	await all;
}

async function processAddressAvatarMessage(
	db: DBInstance,
	{ payload: { address } }: InferAddressAvatarQueueMessage
) {
	const identity = await db.query.identityTable.findFirst({
		where: (t, { eq }) => eq(t.id, address),
	});
	if (!identity) return;

	const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
	const isInferenceOlderThan7Days = Date.now() - identity.updatedAt.getTime() > SEVEN_DAYS_MS;
	if (!isInferenceOlderThan7Days) return;

	const inferredAvatar = await resolveAvatar(address).catch(() => undefined);
	if (!inferredAvatar) return;

	const now = new Date();
	await db
		.update(identityTable)
		.set({ inferredAvatar, updatedAt: now })
		.where(eq(identityTable.address, address));
}

async function processThumbnailMessage(env: CloudflareBindings, message: ThumbnailQueueMessage) {
	const { payload } = message;
	if (!payload.storageKey) return;

	const object = await env.R2_EMAILS.get(payload.storageKey);
	if (!object) return;

	const arrayBuffer = await object.arrayBuffer();
	if (!arrayBuffer.byteLength) return;

	const mimeType = payload.mimeType ?? object.httpMetadata?.contentType ?? undefined;

	const headers: Record<string, string> = {
		"x-background-secret": env.BACKGROUND_SECRET,
		"content-type": mimeType ?? "application/octet-stream",
	};

	if (payload.filename) headers["x-filename"] = payload.filename;
	if (mimeType) headers["x-mime-type"] = mimeType;

	const container = await getRandom(env.BACKGROUND_CONTAINER, 1);
	const response = await container.fetch("https://container/thumbnail", {
		method: "POST",
		body: arrayBuffer,
		headers,
	});

	if (response.ok && response.headers.get("content-type") === "image/webp") {
		const thumbnail = new Uint8Array(await response.arrayBuffer());
		if (thumbnail.byteLength) {
			await env.R2_EMAILS.put(`${payload.storageKey}/thumbnail`, thumbnail, {
				httpMetadata: { contentType: "image/webp" },
			});
		}
	}
}
