import type { OutboundDeliveryResult, OutboundMessage } from "./types";

export interface OutboundTransport {
	// Fire-and-forget from JMAP’s perspective:
	// - On success: provider accepted the message for delivery.
	// - On failure: we can decide whether to mark the submission as failed or retry.
	send(message: OutboundMessage): Promise<OutboundDeliveryResult>;
}
