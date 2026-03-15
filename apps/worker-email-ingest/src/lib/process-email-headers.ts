import type { EmailMessageMetadata, EmailMessageMetadataAddress } from "@gebna/db/schema";
import type { Email } from "postal-mime";

const MAX_ID_COUNT = 100;

export function extractMessageIdsFromPostalMimeValue(value?: string | null): string[] {
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

export function getEmailMessageMetadata(parsedEnvelope: Email): EmailMessageMetadata {
	const to = (parsedEnvelope.to?.filter((a) => !!a.address) ?? []) as EmailMessageMetadataAddress[];
	const cc = (parsedEnvelope.cc?.filter((a) => !!a.address) ?? []) as EmailMessageMetadataAddress[];
	const bcc = (parsedEnvelope.bcc?.filter((a) => !!a.address) ??
		[]) as EmailMessageMetadataAddress[];
	const replyTo = (parsedEnvelope.replyTo?.filter((a) => !!a.address) ??
		[]) as EmailMessageMetadataAddress[];

	return {
		to,
		bcc,
		cc,
		replyTo,
		inReplyTo: parsedEnvelope.inReplyTo,
		references: parsedEnvelope.references,
	};
}
