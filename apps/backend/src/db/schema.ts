import {
	customType,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

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

// ───────────────────────────────────────────────────────────
// User + Session
// ───────────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────────
// Account (mail identity)
// ───────────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────────
// Mailboxes
// ───────────────────────────────────────────────────────────

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
	}),
	(self) => [
		uniqueIndex("ux_mailbox_account_name").on(self.accountId, self.name),
		uniqueIndex("ux_mailbox_account_role").on(self.accountId, self.role),
		index("idx_mailbox_account").on(self.accountId),
	]
);

// ───────────────────────────────────────────────────────────
// Threads (per account)
// ───────────────────────────────────────────────────────────

export const threadTable = sqliteTable(
	"thread",
	(t) => ({
		id: t.text().primaryKey(),

		accountId: t
			.text()
			.notNull()
			.references(() => accountTable.id, { onDelete: "cascade" }),

		subject: t.text(),
		createdAt: t.integer({ mode: "timestamp" }).notNull(),
		latestMessageAt: t.integer({ mode: "timestamp" }).notNull(),
	}),
	(self) => [index("idx_thread_account_latest").on(self.accountId, self.latestMessageAt)]
);

// ───────────────────────────────────────────────────────────
// Blob (dedup)
// ───────────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────────
// Canonical message (shared)
// ───────────────────────────────────────────────────────────

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

		size: t.integer(),
	}),
	(self) => [
		uniqueIndex("ux_message_ingest").on(self.ingestId),
		index("idx_message_message_id").on(self.messageId),
		index("idx_message_created_at").on(self.createdAt),
	]
);

// ───────────────────────────────────────────────────────────
// Per-account message listing (flags)
// ───────────────────────────────────────────────────────────

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
		updatedAt: t.integer({ mode: "timestamp" }).notNull(),
	}),
	(self) => [
		uniqueIndex("ux_account_message_account_msg").on(self.accountId, self.messageId),
		index("idx_account_message_account_date").on(self.accountId, self.internalDate),
		index("idx_account_message_thread").on(self.accountId, self.threadId, self.internalDate),
	]
);

// ───────────────────────────────────────────────────────────
// Mailbox mapping
// ───────────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────────
// Attachments
// ───────────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────────
// Addresses + Message → Address relation
// ───────────────────────────────────────────────────────────

export const addressTable = sqliteTable(
	"address",
	(t) => ({
		id: t.text().primaryKey(),
		email: t.text().notNull(),
		name: t.text(),
	}),
	(self) => [index("idx_address_email").on(self.email)]
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
