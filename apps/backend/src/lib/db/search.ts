import { sql } from "drizzle-orm";

import type { DBInstance } from ".";

export type MessageSearchResult = {
	threadId: string;
	messageId: string;
};

type SearchMessagesArgs = {
	ownerId: string;
	query: string;
	mailboxId?: string | null;
	limit?: number;
	offset?: number;
};

export const searchMessages = async (
	db: DBInstance,
	{ ownerId, query, mailboxId, limit = 20, offset = 0 }: SearchMessagesArgs
): Promise<MessageSearchResult[]> => {
	const mailboxFilter = mailboxId ?? null;
	const cappedLimit = Math.max(1, limit);
	const safeOffset = Math.max(0, offset);

	const rows = await db.all<MessageSearchResult>(
		sql`SELECT threadId, messageId
        FROM message_fts
        WHERE ownerId = ${ownerId}
          AND (${mailboxFilter} IS NULL OR mailboxId = ${mailboxFilter})
          AND message_fts MATCH ${query}
        ORDER BY bm25(message_fts)
        LIMIT ${cappedLimit} OFFSET ${safeOffset}`
	);

	return rows;
};
