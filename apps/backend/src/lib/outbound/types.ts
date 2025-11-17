// Core types for outbound email, provider-agnostic.

export type OutboundEnvelope = {
	// RFC5321 envelope sender (MAIL FROM). Used for bounces.
	mailFrom: string;

	// RFC5321 envelope recipients (RCPT TO). Must be non-empty.
	rcptTo: string[];
};

export type OutboundMimeRef =
	| {
			// Raw MIME is provided inline (already constructed).
			kind: "inline";
			raw: string; // full RFC5322 message
	  }
	| {
			// Raw MIME is stored by sha256 in blob storage (R2) and referenced here.
			kind: "blob";
			sha256: string;
			size: number;
	  };

export type OutboundMessage = {
	// Internal identifiers so we can correlate SES logs / failures back to JMAP.
	accountId: string;
	// JMAP EmailSubmission id or some internal submission id.
	submissionId: string;
	// JMAP Email id this submission refers to.
	emailId: string;

	envelope: OutboundEnvelope;
	mime: OutboundMimeRef;

	// Optional metadata for logging / abuse heuristics.
	clientIp?: string;
	userAgent?: string;
};

export type OutboundDeliveryStatus =
	// Accepted by provider / on their queue.
	| "accepted"
	// Provider says permanent failure (bad address, policy rejection, etc.).
	| "rejected"
	// Temporary failure (provider/infra problem, can be retried).
	| "failed";

export type OutboundDeliveryResult = {
	status: OutboundDeliveryStatus;

	// Provider-specific identifiers for later webhook / log correlation.
	providerMessageId?: string;
	providerRequestId?: string;

	// Human-readable summary from provider when status !== "accepted".
	reason?: string;

	// Should we treat this as a permanent failure (don’t retry)?
	permanent?: boolean;
};
