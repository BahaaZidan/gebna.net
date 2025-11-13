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

export const userTable = sqliteTable("user", {
	id: text().primaryKey(),
	username: citext().notNull().unique(),
	passwordHash: text().notNull(),
});

export const sessionTable = sqliteTable("session", {
	id: text().primaryKey(),
	userId: text()
		.notNull()
		.references(() => userTable.id),
	refreshHash: text().notNull(),
	userAgent: text(),
	ip: text(),
	createdAt: integer().notNull(), // epoch seconds
	expiresAt: integer().notNull(), // epoch seconds
	revoked: integer({ mode: "boolean" }).notNull().default(false),
});

// ───────────────────────────────────────────────────────────
// Account (mail identity, per address, not auth user)
// ───────────────────────────────────────────────────────────

export const accountTable = sqliteTable(
	"account",
	(t) => ({
		id: t.text().primaryKey(), // ulid/cuid
		address: t.text().notNull(), // "user@gebna.net"
		userId: t
			.text()
			.notNull()
			.references(() => userTable.id), // FK to your auth user table
		createdAt: t.integer({ mode: "timestamp" }).notNull(),
	}),
	(self) => [
		uniqueIndex("ux_account_address").on(self.address),
		index("idx_account_user").on(self.userId),
	]
);

// ───────────────────────────────────────────────────────────
// Mailboxes (folders/labels) per account
// ───────────────────────────────────────────────────────────

export const mailboxTable = sqliteTable(
	"mailbox",
	(t) => ({
		id: t.text().primaryKey(), // ulid/cuid
		accountId: t
			.text()
			.notNull()
			.references(() => accountTable.id, { onDelete: "cascade" }),

		name: t.text().notNull(), // "Inbox", "Sent", etc.
		role: t.text(), // "inbox" | "sent" | "trash" | ...

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
		id: t.text().primaryKey(), // ulid/cuid
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
// Blob (raw MIME + attachment blobs) — dedupe by sha256
// ───────────────────────────────────────────────────────────

export const blobTable = sqliteTable(
	"blob",
	(t) => ({
		sha256: t.text().primaryKey(), // hex sha256(raw bytes)
		size: t.integer().notNull(), // bytes
		r2Key: t.text(), // if R2 key differs from sha256
		createdAt: t.integer({ mode: "timestamp" }).notNull(),
	}),
	(_self) => []
);

// ───────────────────────────────────────────────────────────
// Canonical message (shared content, no per-account flags)
// ───────────────────────────────────────────────────────────

export const messageTable = sqliteTable(
	"message",
	(t) => ({
		id: t.text().primaryKey(), // ulid/cuid

		// idempotency key for the inbound event
		ingestId: t.text().notNull(),

		rawBlobSha256: t
			.text()
			.notNull()
			.references(() => blobTable.sha256, { onDelete: "restrict" }),

		// RFC 5322 Message-ID + threading headers
		messageId: t.text(), // NOT unique
		inReplyTo: t.text(),
		referencesJson: t.text(), // JSON array of Message-IDs

		subject: t.text(),
		snippet: t.text(), // preview for list view

		sentAt: t.integer({ mode: "timestamp" }), // Date header
		createdAt: t.integer({ mode: "timestamp" }).notNull(), // stored-at time

		size: t.integer(),
	}),
	(self) => [
		uniqueIndex("ux_message_ingest").on(self.ingestId),
		index("idx_message_message_id").on(self.messageId),
		index("idx_message_created_at").on(self.createdAt),
	]
);

// ───────────────────────────────────────────────────────────
// Per-account message listing (flags, thread, internal date)
// ───────────────────────────────────────────────────────────

export const accountMessageTable = sqliteTable(
	"account_message",
	(t) => ({
		id: t.text().primaryKey(), // ulid/cuid

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
		// one row per (account, canonical message)
		uniqueIndex("ux_account_message_account_msg").on(self.accountId, self.messageId),

		index("idx_account_message_account_date").on(self.accountId, self.internalDate),

		index("idx_account_message_thread").on(self.accountId, self.threadId, self.internalDate),
	]
);

// ───────────────────────────────────────────────────────────
// Mailbox mapping (many mailboxes per accountMessage)
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
// Attachments — tied to canonical message, dedup via blob
// ───────────────────────────────────────────────────────────

export const attachmentTable = sqliteTable(
	"attachment",
	(t) => ({
		id: t.text().primaryKey(), // ulid/cuid

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

		disposition: t.text(), // "attachment" | "inline" | null
		contentId: t.text(), // for cid: URLs
		related: t.integer({ mode: "boolean" }).notNull().default(false),

		position: t.integer().notNull().default(0),
	}),
	(self) => [index("idx_attachment_message").on(self.messageId, self.position)]
);

// ───────────────────────────────────────────────────────────
// Addresses (normalized) + message ↔ address relation
// ───────────────────────────────────────────────────────────

export const addressTable = sqliteTable(
	"address",
	(t) => ({
		id: t.text().primaryKey(), // ulid/cuid
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

		// "from" | "sender" | "to" | "cc" | "bcc" | "reply-to"
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
