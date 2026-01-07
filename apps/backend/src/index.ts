import { Container } from "@cloudflare/containers";
import { WorkerEntrypoint } from "cloudflare:workers";

import type { QueueMessage } from "$lib/queue/messages";
import { emailHandler } from "./worker-handlers/email";
import { fetchHandler } from "./worker-handlers/fetch";
import { queueHandler } from "./worker-handlers/queue";
import { scheduledHandler } from "./worker-handlers/scheduled";

export class BackgroundContainer extends Container<CloudflareBindings> {
	defaultPort = 8787;
	sleepAfter = "10m";
	envVars = {
		BACKGROUND_SECRET: this.env.BACKGROUND_SECRET,
	};
}

export default class extends WorkerEntrypoint<CloudflareBindings> {
	fetch(req: Request) {
		return fetchHandler(req, this.env, this.ctx);
	}
	email(message: ForwardableEmailMessage) {
		return emailHandler(message, this.env, this.ctx);
	}
	scheduled(controller: ScheduledController) {
		return scheduledHandler(controller, this.env);
	}
	queue(batch: MessageBatch<QueueMessage>) {
		return queueHandler(batch, this.env, this.ctx);
	}
}
