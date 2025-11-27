export const JMAP_CORE = "urn:ietf:params:jmap:core";
export const JMAP_MAIL = "urn:ietf:params:jmap:mail";
export const JMAP_SUBMISSION = "urn:ietf:params:jmap:submission";
export const JMAP_VACATION = "urn:ietf:params:jmap:vacationresponse";
export const JMAP_BLOB = "urn:ietf:params:jmap:blob";
export const JMAP_PUSH = "urn:ietf:params:jmap:push";

export const JMAP_CONSTRAINTS = {
	[JMAP_CORE]: {
		// Limited by Cloudflare Email Routing 25 MiB total message size
		// and common SMTP limits (Gmail, Outlook, Yahoo, etc).
		maxSizeUpload: 18 * 1024 * 1024, // ~18 MiB of binary -> ~24 MiB encoded

		// These are app/resource limits; you can tune them later.
		maxConcurrentUpload: 4,

		// JMAP request body is JSON, not raw MIME; 10 MiB is generous here.
		maxSizeRequest: 10 * 1024 * 1024,
		maxConcurrentRequests: 4,
		maxCallsInRequest: 16,
		maxObjectsInGet: 256,
		maxObjectsInSet: 128,

		collationAlgorithms: ["i;ascii-numeric"],
	},

	[JMAP_MAIL]: {
		// Mostly internal / UX limits, not constrained by Cloudflare/Gmail.
		maxMailboxesPerEmail: 32,
		maxEmailsPerMailbox: null,
		maxMailboxDepth: null,
		maxSizeMailboxName: 255,

		// Keep below Cloudflare + SMTP real-world max once encoded.
		maxSizeAttachmentsPerEmail: 18 * 1024 * 1024, // match maxSizeUpload

		// You can add more later if your implementation supports them.
		emailQuerySortOptions: ["receivedAt", "sentAt", "size"],
	},

	[JMAP_SUBMISSION]: {},

	[JMAP_VACATION]: {},

	[JMAP_BLOB]: {},

	[JMAP_PUSH]: {
		maxSubscriptionsPerAccount: 32,
	},
};

export const JMAP_BLOB_ACCOUNT_CAPABILITY = {
	maxSizeBlobSet: JMAP_CONSTRAINTS[JMAP_CORE].maxSizeUpload,
	maxDataSources: 1,
	supportedTypeNames: ["Email", "EmailBodyValue"],
	supportedDigestAlgorithms: ["sha-256"],
};
