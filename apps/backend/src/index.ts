import { WorkerEntrypoint } from "cloudflare:workers";

import { emailHandler } from "./worker-handlers/email";
import { fetchHandler } from "./worker-handlers/fetch";
import { scheduledHandler } from "./worker-handlers/scheduled";

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
}
