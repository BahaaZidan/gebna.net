import { SesOutboundTransport } from "./ses-transport";
import type { OutboundTransport } from "./transport";

export function createOutboundTransport(env: CloudflareBindings): OutboundTransport {
	return new SesOutboundTransport({
		region: env.AWS_SES_REGION,
		accessKeyId: env.AWS_SES_ACCESS_KEY_ID,
		secretAccessKey: env.AWS_SES_SECRET_ACCESS_KEY,
		r2: env.R2_EMAILS,
	});
}
