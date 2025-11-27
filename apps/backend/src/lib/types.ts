export type DeliveryStatusRecord = {
	smtpReply: string | null;
	delivered: "queued" | "yes" | "no" | "unknown";
	displayed: "unknown" | "yes";
	providerMessageId?: string;
	providerRequestId?: string;
};
