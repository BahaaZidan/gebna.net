import type { Email } from "postal-mime";

import { dbSchema, type TransactionInstance } from "#/lib/db";

export * from "./process-email-body";
export * from "./infer-address-avatar";
export * from "./rehype-enforce-palette";

/**
 * * This encapsulates the threading.
 * * This does not consider plus addressing. (Can be added later).
 * * It also does not consider Gmail dot stripping. (Can be added partially later. There's no way of doing it with workspace address.)
 */
export async function findOrCreateThread({
	tx,
	ownerId,
	parsedEnvelope,
}: {
	tx: TransactionInstance;
	ownerId: string;
	parsedEnvelope: Email;
}): Promise<typeof dbSchema.emailThreads.$inferSelect> {
	const targetMessageIds = extractMessageIdsFromPostalMimeValue(
		`${parsedEnvelope.inReplyTo || ""} ${parsedEnvelope.references || ""}`,
	);
	let pastMessage = targetMessageIds.length
		? await tx.query.emailMessages.findFirst({
				where: {
					ownerId,
					canonicalMessageId: { in: targetMessageIds },
				},
				columns: {},
				with: { thread: true },
			})
		: null;
	if (pastMessage?.thread) return pastMessage.thread;

	const [newThread] = await tx
		.insert(dbSchema.emailThreads)
		.values({
			ownerId,
			title: parsedEnvelope.subject,
		})
		.returning();

	return newThread;
}

const MAX_ID_COUNT = 100;

export function extractMessageIdsFromPostalMimeValue(
	value?: string | null,
): string[] {
	if (!value) return [];

	const out: string[] = [];
	const seen = new Set<string>();

	const matches = value.match(/<[^<>\s]+>/g) ?? [];

	for (const m of matches) {
		const id = m.trim();

		// RFC 5322 msg-id requires an "@"
		if (!id.includes("@")) continue;

		if (!seen.has(id)) {
			seen.add(id);
			out.push(id);
			if (out.length >= MAX_ID_COUNT) break;
		}
	}

	return out;
}

export function getEmailMessageMetadata(
	parsedEnvelope: Email,
): dbSchema.EmailMessageMetadata {
	const to = (parsedEnvelope.to?.filter((a) => !!a.address) ??
		[]) as dbSchema.EmailMessageMetadataAddress[];
	const cc = (parsedEnvelope.cc?.filter((a) => !!a.address) ??
		[]) as dbSchema.EmailMessageMetadataAddress[];
	const bcc = (parsedEnvelope.bcc?.filter((a) => !!a.address) ??
		[]) as dbSchema.EmailMessageMetadataAddress[];
	const replyTo = (parsedEnvelope.replyTo?.filter((a) => !!a.address) ??
		[]) as dbSchema.EmailMessageMetadataAddress[];

	return {
		to,
		bcc,
		cc,
		replyTo,
		inReplyTo: parsedEnvelope.inReplyTo,
		references: parsedEnvelope.references,
	};
}

export function stripAngleBrackets(value: string): string {
	if (value.startsWith("<") && value.endsWith(">")) {
		return value.slice(1, -1);
	}
	return value;
}
