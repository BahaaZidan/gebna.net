import { and, eq, inArray } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import {
	accountMessageTable,
	addressTable,
	emailKeywordTable,
	mailboxMessageTable,
	messageAddressTable,
	messageTable,
} from "../../../db/schema";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";

export async function handleEmailGet(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);

	const accountIdArg = args.accountId as string | undefined;
	const effectiveAccountId = ensureAccountAccess(c, accountIdArg);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}
	const state = await getAccountState(db, effectiveAccountId, "Email");

	const ids = (args.ids as string[] | undefined) ?? [];
	if (!ids.length) {
		return ["Email/get", { accountId: effectiveAccountId, state, list: [], notFound: [] }, tag];
	}

	const rows = await db
		.select({
			emailId: accountMessageTable.id,
			messageId: messageTable.id,
			threadId: accountMessageTable.threadId,
			internalDate: accountMessageTable.internalDate,
			subject: messageTable.subject,
			snippet: messageTable.snippet,
			sentAt: messageTable.sentAt,
			rawBlobSha256: messageTable.rawBlobSha256,
			size: messageTable.size,
			hasAttachment: messageTable.hasAttachment,
			bodyStructureJson: messageTable.bodyStructureJson,
			isSeen: accountMessageTable.isSeen,
			isFlagged: accountMessageTable.isFlagged,
			isAnswered: accountMessageTable.isAnswered,
			isDraft: accountMessageTable.isDraft,
		})
		.from(accountMessageTable)
		.innerJoin(messageTable, eq(accountMessageTable.messageId, messageTable.id))
		.where(
			and(
				eq(accountMessageTable.accountId, effectiveAccountId),
				inArray(accountMessageTable.id, ids)
			)
		);

	if (!rows.length) {
		return ["Email/get", { accountId: effectiveAccountId, state, list: [], notFound: ids }, tag];
	}

	const mailboxRows = await db
		.select({
			emailId: mailboxMessageTable.accountMessageId,
			mailboxId: mailboxMessageTable.mailboxId,
		})
		.from(mailboxMessageTable)
		.where(
			inArray(
				mailboxMessageTable.accountMessageId,
				rows.map((r) => r.emailId)
			)
		);

	const mailboxMap = new Map<string, string[]>();
	for (const row of mailboxRows) {
		const arr = mailboxMap.get(row.emailId) ?? [];
		arr.push(row.mailboxId);
		mailboxMap.set(row.emailId, arr);
	}

	const keywordRows = await db
		.select({
			emailId: emailKeywordTable.accountMessageId,
			keyword: emailKeywordTable.keyword,
		})
		.from(emailKeywordTable)
		.where(
			inArray(
				emailKeywordTable.accountMessageId,
				rows.map((r) => r.emailId)
			)
		);

	const customKeywords = new Map<string, string[]>();
	for (const row of keywordRows) {
		const arr = customKeywords.get(row.emailId) ?? [];
		arr.push(row.keyword);
		customKeywords.set(row.emailId, arr);
	}

	const addressRows = await db
		.select({
			messageId: messageAddressTable.messageId,
			kind: messageAddressTable.kind,
			position: messageAddressTable.position,
			email: addressTable.email,
			name: addressTable.name,
		})
		.from(messageAddressTable)
		.innerJoin(addressTable, eq(messageAddressTable.addressId, addressTable.id))
		.where(
			inArray(
				messageAddressTable.messageId,
				rows.map((r) => r.messageId)
			)
		);

	type JmapEmailAddress = { email: string; name?: string | null };
	const addrsByMsg = new Map<string, Record<string, JmapEmailAddress[]>>();

	for (const row of addressRows) {
		const perMsg = addrsByMsg.get(row.messageId) ?? {};
		const list = perMsg[row.kind] ?? [];
		list[row.position] = {
			email: row.email,
			name: row.name,
		};
		perMsg[row.kind] = list;
		addrsByMsg.set(row.messageId, perMsg);
	}

	const list = rows.map((row) => {
		const mailboxes = mailboxMap.get(row.emailId) ?? [];
		const addrKinds = addrsByMsg.get(row.messageId) ?? {};
		const from = addrKinds["from"] ?? [];
		const to = addrKinds["to"] ?? [];
		const cc = addrKinds["cc"] ?? [];
		const bcc = addrKinds["bcc"] ?? [];

		const keywords: Record<string, boolean> = {};
		if (row.isSeen) keywords["$seen"] = true;
		if (row.isFlagged) keywords["$flagged"] = true;
		if (row.isAnswered) keywords["$answered"] = true;
		if (row.isDraft) keywords["$draft"] = true;

		const customList = customKeywords.get(row.emailId) ?? [];
		for (const keyword of customList) {
			keywords[keyword] = true;
		}

		let bodyStructure: unknown = null;
		if (row.bodyStructureJson) {
			try {
				bodyStructure = JSON.parse(row.bodyStructureJson);
			} catch {
				bodyStructure = null;
			}
		}

		return {
			id: row.emailId,
			threadId: row.threadId,
			mailboxIds: mailboxes,
			subject: row.subject,
			sentAt: row.sentAt ? new Date(row.sentAt).toISOString() : null,
			receivedAt: new Date(row.internalDate).toISOString(),
			preview: row.snippet,
			size: row.size,
			blobId: row.rawBlobSha256,
			hasAttachment: row.hasAttachment,
			bodyStructure,
			keywords,
			from,
			to,
			cc,
			bcc,
		};
	});

	const foundIds = new Set(list.map((e) => e.id));
	const notFound = ids.filter((id) => !foundIds.has(id));

	return [
		"Email/get",
		{
			accountId: effectiveAccountId,
			state,
			list,
			notFound,
		},
		tag,
	];
}
