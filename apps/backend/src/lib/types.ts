export type DeliveryStatusRecord = {
	status: "pending" | "accepted" | "rejected" | "failed";
	providerMessageId?: string;
	providerRequestId?: string;
	reason?: string;
	lastAttempt: number; // unix timestamp
	retryCount: number;
	permanent?: boolean;
};
