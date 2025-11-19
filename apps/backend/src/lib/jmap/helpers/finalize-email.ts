import { and, eq, inArray } from "drizzle-orm";

import { type TransactionInstance } from "../../../db";
import { accountMessageTable, emailKeywordTable, mailboxMessageTable } from "../../../db/schema";
import { recordEmailUpdateChanges } from "../change-log";

export async function finalizeEmailAfterSubmission(opts: {
	tx: TransactionInstance;
	accountId: string;
	emailId: string;
	threadId: string;
	sentMailboxId: string | null;
	draftsMailboxId: string | null;
	now: Date;
}): Promise<void> {
	const { tx, accountId, emailId, threadId, sentMailboxId, draftsMailboxId, now } = opts;
	const touchedMailboxIds: string[] = [];

	const membershipRows = await tx
		.select({ mailboxId: mailboxMessageTable.mailboxId })
		.from(mailboxMessageTable)
		.where(eq(mailboxMessageTable.accountMessageId, emailId));

	const membershipSet = new Set(membershipRows.map((row) => row.mailboxId));

	if (draftsMailboxId && membershipSet.has(draftsMailboxId)) {
		await tx
			.delete(mailboxMessageTable)
			.where(
				and(
					eq(mailboxMessageTable.accountMessageId, emailId),
					eq(mailboxMessageTable.mailboxId, draftsMailboxId)
				)
			);
		touchedMailboxIds.push(draftsMailboxId);
	}

	if (sentMailboxId && !membershipSet.has(sentMailboxId)) {
		await tx
			.insert(mailboxMessageTable)
			.values({
				accountMessageId: emailId,
				mailboxId: sentMailboxId,
				addedAt: now,
			})
			.onConflictDoNothing();
		touchedMailboxIds.push(sentMailboxId);
	}

	await tx
		.update(accountMessageTable)
		.set({
			isDraft: false,
			updatedAt: now,
		})
		.where(eq(accountMessageTable.id, emailId));

	await tx
		.delete(emailKeywordTable)
		.where(
			and(
				eq(emailKeywordTable.accountMessageId, emailId),
				inArray(emailKeywordTable.keyword, ["$draft", "\\draft"])
			)
		);

	await recordEmailUpdateChanges({
		tx,
		accountId,
		accountMessageId: emailId,
		threadId,
		mailboxIds: touchedMailboxIds,
		now,
	});
}
