export type SeedRawEmailOptions = {
	reset?: boolean;
	recipientUsername?: string;
	recipientEmail?: string;
	limit?: number;
	offset?: number;
};

export type SeedRawEmailResult = {
	status: "unsupported";
	message: string;
};

/**
 * Raw email seeding relied on legacy thread/mailbox tables that no longer exist.
 * Leaving a stub here keeps the endpoint stable while Phase 3 reshapes ingest.
 */
export async function seedRawEmails(
	_env: CloudflareBindings,
	_options: SeedRawEmailOptions = {}
): Promise<SeedRawEmailResult> {
	return {
		status: "unsupported",
		message: "Raw email seeding is not available with the current schema. Use /seed/demo instead.",
	};
}
