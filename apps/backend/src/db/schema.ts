import {
	customType,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { DeliveryStatusRecord } from "../lib/types";

const citext = customType<{
	data: string;
	notNull: true;
	default: true;
	config: { length?: number };
}>({
	dataType(config) {
		return `text${config?.length ? `(${config.length})` : ""} COLLATE NOCASE`;
	},
});

export const userTable = sqliteTable("user", {
	id: text().primaryKey(),
	username: citext().notNull().unique(),
	passwordHash: text().notNull(),
});

export const sessionTable = sqliteTable("session", {
	id: text().primaryKey(),
	userId: text()
		.notNull()
		.references(() => userTable.id, { onDelete: "cascade" }),
	refreshHash: text().notNull(),
	userAgent: text(),
	ip: text(),
	createdAt: integer().notNull(),
	expiresAt: integer().notNull(),
	revoked: integer({ mode: "boolean" }).notNull().default(false),
});

export const accountTable = sqliteTable(
	"account",
	(t) => ({
		id: t.text().primaryKey(),
		address: t.text().notNull(),
		userId: t
			.text()
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		createdAt: t.integer({ mode: "timestamp" }).notNull(),
	}),
	(self) => [
		uniqueIndex("ux_account_address").on(self.address),
		index("idx_account_user").on(self.userId),
	]
);

export const mailboxTable = sqliteTable(
	"mailbox",
	(t) => ({
		id: t.text().primaryKey(),
		accountId: t
			.text()
			.notNull()
			.references(() => accountTable.id, { onDelete: "cascade" }),
		name: t.text().notNull(),
		role: t.text(),
		sortOrder: t.integer().notNull().default(0),
		createdAt: t.integer({ mode: "timestamp" }).notNull(),
		updatedAt: t.integer({ mode: "timestamp" }),
	}),
	(self) => [
		uniqueIndex("ux_mailbox_account_name").on(self.accountId, self.name),
		uniqueIndex("ux_mailbox_account_role").on(self.accountId, self.role),
		index("idx_mailbox_account").on(self.accountId),
	]
);

export const threadTable = sqliteTable(
	"thread",
	(t) => ({
		id: t.text().primaryKey(),
		accountId: t
			.text()
			.notNull()
			.references(() => accountTable.id, { onDelete: "cascade" }),
		subject: t.text(),
		latestMessageAt: t.integer({ mode: "timestamp" }).notNull(),
		createdAt: t.integer({ mode: "timestamp" }).notNull(),
		updatedAt: t.integer({ mode: "timestamp" }),
	}),
	(self) => [index("idx_thread_account_latest").on(self.accountId, self.latestMessageAt)]
);

export const blobTable = sqliteTable(
	"blob",
	(t) => ({
		sha256: t.text().primaryKey(),
		size: t.integer().notNull(),
		r2Key: t.text(),
		createdAt: t.integer({ mode: "timestamp" }).notNull(),
	}),
	(_self) => []
);

export const accountBlobTable = sqliteTable(
	"account_blob",
	(t) => ({
		accountId: t
			.text()
			.notNull()
			.references(() => accountTable.id, { onDelete: "cascade" }),
		sha256: t
			.text()
			.notNull()
			.references(() => blobTable.sha256, { onDelete: "cascade" }),
		createdAt: t.integer({ mode: "timestamp" }).notNull(),
	}),
	(t) => [primaryKey({ columns: [t.accountId, t.sha256] })]
);

export const messageTable = sqliteTable(
	"message",
	(t) => ({
		id: t.text().primaryKey(),
		ingestId: t.text().notNull(),
		rawBlobSha256: t
			.text()
			.notNull()
			.references(() => blobTable.sha256, { onDelete: "restrict" }),
		messageId: t.text(),
		inReplyTo: t.text(),
		referencesJson: t.text(),
		subject: t.text(),
		snippet: t.text(),
		sentAt: t.integer({ mode: "timestamp" }),
		createdAt: t.integer({ mode: "timestamp" }).notNull(),
		size: t.integer().notNull(),
		hasAttachment: t.integer({ mode: "boolean" }).notNull().default(false),
		bodyStructureJson: t.text(),
	}),
	(self) => [
		uniqueIndex("ux_message_ingest").on(self.ingestId),
		index("idx_message_message_id").on(self.messageId),
		index("idx_message_created_at").on(self.createdAt),
	]
);

export const accountMessageTable = sqliteTable(
	"account_message",
	(t) => ({
		id: t.text().primaryKey(),
		accountId: t
			.text()
			.notNull()
			.references(() => accountTable.id, { onDelete: "cascade" }),
		messageId: t
			.text()
			.notNull()
			.references(() => messageTable.id, { onDelete: "cascade" }),
		threadId: t
			.text()
			.notNull()
			.references(() => threadTable.id, { onDelete: "cascade" }),
		internalDate: t.integer({ mode: "timestamp" }).notNull(),
		isSeen: t.integer({ mode: "boolean" }).notNull().default(false),
		isFlagged: t.integer({ mode: "boolean" }).notNull().default(false),
		isAnswered: t.integer({ mode: "boolean" }).notNull().default(false),
		isDraft: t.integer({ mode: "boolean" }).notNull().default(false),
		isDeleted: t.integer({ mode: "boolean" }).notNull().default(false),
		createdAt: t.integer({ mode: "timestamp" }).notNull(),
		updatedAt: t.integer({ mode: "timestamp" }),
	}),
	(self) => [
		uniqueIndex("ux_account_message_account_msg").on(self.accountId, self.messageId),
		index("idx_account_message_account_date").on(self.accountId, self.internalDate),
		index("idx_account_message_thread").on(self.accountId, self.threadId, self.internalDate),
	]
);

export const mailboxMessageTable = sqliteTable(
	"mailbox_message",
	(t) => ({
		accountMessageId: t
			.text()
			.notNull()
			.references(() => accountMessageTable.id, { onDelete: "cascade" }),
		mailboxId: t
			.text()
			.notNull()
			.references(() => mailboxTable.id, { onDelete: "cascade" }),
		addedAt: t.integer({ mode: "timestamp" }).notNull(),
	}),
	(self) => [
		primaryKey({
			name: "pk_mailbox_message",
			columns: [self.accountMessageId, self.mailboxId],
		}),
		index("idx_mailbox_message_mailbox").on(self.mailboxId),
	]
);

export const attachmentTable = sqliteTable(
	"attachment",
	(t) => ({
		id: t.text().primaryKey(),
		messageId: t
			.text()
			.notNull()
			.references(() => messageTable.id, { onDelete: "cascade" }),
		blobSha256: t
			.text()
			.notNull()
			.references(() => blobTable.sha256, { onDelete: "restrict" }),
		filename: t.text(),
		mimeType: t.text().notNull(),
		disposition: t.text(),
		contentId: t.text(),
		related: t.integer({ mode: "boolean" }).notNull().default(false),
		position: t.integer().notNull().default(0),
	}),
	(self) => [index("idx_attachment_message").on(self.messageId, self.position)]
);

export const addressTable = sqliteTable(
	"address",
	(t) => ({
		id: t.text().primaryKey(),
		email: t.text().notNull(),
		name: t.text(),
	}),
	(self) => [uniqueIndex("ux_address_email").on(self.email)]
);

export const messageAddressTable = sqliteTable(
	"message_address",
	(t) => ({
		messageId: t
			.text()
			.notNull()
			.references(() => messageTable.id, { onDelete: "cascade" }),
		addressId: t
			.text()
			.notNull()
			.references(() => addressTable.id, { onDelete: "cascade" }),
		kind: t.text().notNull(),
		position: t.integer().notNull().default(0),
	}),
	(self) => [
		primaryKey({
			name: "pk_message_address",
			columns: [self.messageId, self.addressId, self.kind, self.position],
		}),
		index("idx_message_address_msg_kind").on(self.messageId, self.kind, self.position),
	]
);

export const jmapStateTable = sqliteTable(
	"jmap_state",
	(t) => ({
		accountId: t
			.text()
			.notNull()
			.references(() => accountTable.id, { onDelete: "cascade" }),
		type: t.text().notNull(),
		modSeq: t.integer().notNull(),
	}),
	(self) => [primaryKey({ columns: [self.accountId, self.type] })]
);

export const emailKeywordTable = sqliteTable(
	"email_keyword",
	(t) => ({
		accountMessageId: t
			.text()
			.notNull()
			.references(() => accountMessageTable.id, { onDelete: "cascade" }),
		keyword: t.text().notNull(),
	}),
	(self) => [
		primaryKey({ columns: [self.accountMessageId, self.keyword] }),
		index("idx_email_keyword_keyword").on(self.keyword),
	]
);

export const uploadTable = sqliteTable(
	"upload",
	(t) => ({
		id: t.text().primaryKey(),
		accountId: t
			.text()
			.notNull()
			.references(() => accountTable.id, { onDelete: "cascade" }),
		blobSha256: t
			.text()
			.notNull()
			.references(() => blobTable.sha256, { onDelete: "cascade" }),
		type: t.text().notNull(),
		name: t.text(),
		size: t.integer().notNull(),
		expiresAt: t.integer({ mode: "timestamp" }).notNull(),
		createdAt: t.integer({ mode: "timestamp" }).notNull(),
	}),
	(self) => [
		index("idx_upload_account").on(self.accountId),
		index("idx_upload_expires").on(self.expiresAt),
	]
);

export const identityTable = sqliteTable(
	"identity",
	(t) => ({
		id: t.text().primaryKey(),
		accountId: t
			.text()
			.notNull()
			.references(() => accountTable.id, { onDelete: "cascade" }),
		name: t.text().notNull(),
		email: t.text().notNull(),
		replyToJson: t.text(),
		bccJson: t.text(),
		textSignature: t.text(),
		htmlSignature: t.text(),
		isDefault: t.integer({ mode: "boolean" }).notNull().default(false),
		createdAt: t.integer({ mode: "timestamp" }).notNull(),
		updatedAt: t.integer({ mode: "timestamp" }),
	}),
	(self) => [index("idx_identity_account").on(self.accountId)]
);

export const emailSubmissionTable = sqliteTable(
	"email_submission",
	(t) => ({
		id: t.text().primaryKey(),
		accountId: t
			.text()
			.notNull()
			.references(() => accountTable.id, { onDelete: "cascade" }),
		emailId: t
			.text()
			.notNull()
			.references(() => accountMessageTable.id, { onDelete: "cascade" }),
		identityId: t
			.text()
			.notNull()
			.references(() => identityTable.id, { onDelete: "restrict" }),
		envelopeJson: t.text().notNull(),
		sendAt: t.integer({ mode: "timestamp" }),
		deliveryStatusJson: t.text({ mode: "json" }).notNull().$type<DeliveryStatusRecord>(),
		undoStatus: t.text(),
		createdAt: t.integer({ mode: "timestamp" }).notNull(),
		updatedAt: t.integer({ mode: "timestamp" }),
	}),
	(self) => [
		index("idx_email_submission_account").on(self.accountId),
		index("idx_email_submission_email").on(self.emailId),
		index("idx_email_submission_send_at").on(self.sendAt),
	]
);

export const vacationResponseTable = sqliteTable("vacation_response", (t) => ({
	accountId: t
		.text()
		.primaryKey()
		.references(() => accountTable.id, { onDelete: "cascade" }),
	isEnabled: t.integer({ mode: "boolean" }).notNull().default(false),
	fromDate: t.integer({ mode: "timestamp" }),
	toDate: t.integer({ mode: "timestamp" }),
	subject: t.text(),
	textBody: t.text(),
	htmlBody: t.text(),
	createdAt: t.integer({ mode: "timestamp" }).notNull(),
	updatedAt: t.integer({ mode: "timestamp" }),
}));

export const vacationResponseLogTable = sqliteTable(
	"vacation_response_log",
	(t) => ({
		accountId: t
			.text()
			.notNull()
			.references(() => accountTable.id, { onDelete: "cascade" }),
		contact: t.text().notNull(),
		respondedAt: t.integer({ mode: "timestamp" }).notNull(),
	}),
	(t) => [primaryKey({ columns: [t.accountId, t.contact] })]
);

export const changeLogTypeValues = ["Email", "Mailbox", "Thread", "Identity", "VacationResponse"] as const;
export type ChangeLogType = (typeof changeLogTypeValues)[number];

export const changeLogOpValues = ["create", "update", "destroy"] as const;
export type ChangeLogOp = (typeof changeLogOpValues)[number];

export const changeLogTable = sqliteTable(
	"change_log",
	(t) => ({
		id: t.text().primaryKey(),
		accountId: t
			.text()
			.notNull()
			.references(() => accountTable.id, { onDelete: "cascade" }),
		type: t.text().notNull().$type<ChangeLogType>(),
		objectId: t.text().notNull(),
		op: t.text().notNull().$type<ChangeLogOp>(),
		modSeq: t.integer().notNull(),
		createdAt: t.integer({ mode: "timestamp" }).notNull(),
	}),
	(self) => [
		index("idx_change_log_account_type_modseq").on(self.accountId, self.type, self.modSeq),
		index("idx_change_log_account_modseq").on(self.accountId, self.modSeq),
	]
);

export const messageHeaderTable = sqliteTable(
	"message_header",
	(t) => ({
		messageId: t
			.text()
			.notNull()
			.references(() => messageTable.id, { onDelete: "cascade" }),
		name: t.text().notNull(), // original case
		lowerName: t.text().notNull(), // for search
		value: t.text().notNull(),
	}),
	(self) => [
		index("idx_message_header_msg").on(self.messageId),
		index("idx_message_header_name").on(self.lowerName),
	]
);
