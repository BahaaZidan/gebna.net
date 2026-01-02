import { getRandom } from "@cloudflare/containers";

import type { ThumbnailQueueMessage } from "$lib/thumbnails/queue";

export async function queueHandler(
	batch: MessageBatch<ThumbnailQueueMessage>,
	env: CloudflareBindings,
	ctx: ExecutionContext
) {
	const tasks = batch.messages.map((message) =>
		(async () => {
			try {
				await processThumbnailMessage(env, message.body);
				message.ack();
			} catch (error) {
				console.error("thumbnail queue processing failed", error);
				message.retry({ delaySeconds: 30 });
			}
		})()
	);

	const all = Promise.all(tasks);
	ctx.waitUntil(all);
	await all;
}

async function processThumbnailMessage(env: CloudflareBindings, message: ThumbnailQueueMessage) {
	if (!message.storageKey) return;

	const object = await env.R2_EMAILS.get(message.storageKey);
	if (!object) return;

	const arrayBuffer = await object.arrayBuffer();
	if (!arrayBuffer.byteLength) return;

	const mimeType = message.mimeType ?? object.httpMetadata?.contentType ?? undefined;

	const headers: Record<string, string> = {
		"x-background-secret": env.BACKGROUND_SECRET,
		"content-type": mimeType ?? "application/octet-stream",
	};

	if (message.filename) headers["x-filename"] = message.filename;
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
			await env.R2_EMAILS.put(`${message.storageKey}/thumbnail`, thumbnail, {
				httpMetadata: { contentType: "image/webp" },
			});
		}
	}
}
