export type JmapMethodResponse = [string, Record<string, unknown>, string];
export type JmapHandlerResult = JmapMethodResponse | JmapMethodResponse[];

export type JmapStateType =
	| "Email"
	| "Mailbox"
	| "Thread"
	| "Identity"
	| "VacationResponse"
	| "EmailSubmission";
