import {
	customType,
	index,
	integer,
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
		.references(() => userTable.id, { onDelete: "cascade" }),
	sessionSecretHash: text().notNull(),
	userAgent: text(),
	ip: text(),
	createdAt: integer().notNull(),
	expiresAt: integer().notNull(),
	revoked: integer({ mode: "boolean" }).notNull().default(false),
});

const _MAILBOX_TYPES = ["screener", "important", "news", "transactional", "trash"] as const;
type MailboxType = (typeof _MAILBOX_TYPES)[number];

export const mailboxTable = sqliteTable(
	"mailbox",
	{
		id: text().primaryKey(),
		userId: text()
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		name: text().notNull(),
		type: text().$type<MailboxType>().notNull(),
	},
	(self) => [
		index("mailbox_user_id").on(self.userId),
		index("mailbox_user_id_type").on(self.userId, self.type),
	]
);

export const address_userTable = sqliteTable(
	"address_user",
	{
		/** The sender. Based on the envelope */
		address: text().notNull(),
		/** The reciever. Based on the envelope */
		userId: text()
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		targetMailboxId: text()
			.notNull()
			.references(() => mailboxTable.id, { onDelete: "cascade" }),
	},
	(self) => [uniqueIndex("address_user_uniq").on(self.address, self.userId)]
);

export const threadTable = sqliteTable(
	"thread",
	{
		/** thread.id based on Headers.messageId if it exists. Otherwise, we make our own id */
		id: text().primaryKey(),
		/** The sender. Based on the first envelope */
		from: text().notNull(),
		/** The reciever. Based on the first envelope */
		recipientId: text()
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		mailboxId: text()
			.notNull()
			.references(() => mailboxTable.id, { onDelete: "cascade" }),
		unreadCount: integer().notNull().default(1),
		/** based on the subject of the first message or its' snippet */
		title: text(),
		lastMessageAt: integer({ mode: "timestamp" })
			.notNull()
			.$default(() => new Date()),
		/** Headers.messageId of the first message */
		firstMessageId: text(),
		/** Headers.subject of the first message */
		firstMessageSubject: text(),
	},
	(self) => [index("idx_thread_mailbox").on(self.mailboxId)]
);

export const messageTable = sqliteTable(
	"message",
	{
		/** our own id */
		id: text().primaryKey(),
		/** Envelope.from */
		from: text().notNull(),
		/** Envelope.to */
		recipientId: text()
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		threadId: text()
			.notNull()
			.references(() => threadTable.id, { onDelete: "cascade" }),
		/** redundant to optimize reads */
		mailboxId: text()
			.notNull()
			.references(() => mailboxTable.id, { onDelete: "cascade" }),
		unread: integer({ mode: "boolean" }).notNull().default(true),
		createdAt: integer({ mode: "timestamp" })
			.notNull()
			.$default(() => new Date()),
		/** Headers.subject */
		subject: text(),
		/** Headers.to */
		to: text({ mode: "json" }).$type<string[]>(),
		/** Headers.cc */
		cc: text({ mode: "json" }).$type<string[]>(),
		/** Headers.bcc */
		bcc: text({ mode: "json" }).$type<string[]>(),
		/** Headers.replyTo ==> indicates the addresses to send the reply to that's possibly different from Envelope.from */
		replyTo: text({ mode: "json" }).$type<string[]>(),
		/** Headers.inReplyTo ==> indicates the Email.messageId that this message is replying to */
		inReplyTo: text(),
		/** Headers.messageId ==> a unique identifier for the message. provided by the vendor */
		messageId: text(),
		/** Headers.references ==> It lists the entire ancestry of the conversation — all the Message-IDs leading up to this email. used for threading */
		references: text(),
		/** Based on Headers.subject or the first (?) characters in the body. */
		snippet: text(),
		/** PostalMime.Email.text */
		bodyText: text(),
		/** PostalMime.Email.html */
		bodyHTML: text(),
		/** Size of the whole Envelope */
		sizeInBytes: integer().notNull(),
	},
	(self) => [
		index("message_thread_idx").on(self.threadId),
		uniqueIndex("uniq_message_recipientId_messageId").on(self.recipientId, self.messageId),
	]
);

export const attachmentTable = sqliteTable(
	"attachment",
	{
		id: text().primaryKey(),
		messageId: text()
			.notNull()
			.references(() => messageTable.id, { onDelete: "cascade" }),
		userId: text()
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		storageKey: text().notNull(),
		sizeInBytes: integer().notNull(),
		fileName: text(),
		mimeType: text(),
		disposition: text().$type<"attachment" | "inline">(),
		contentId: text(),
	},
	(self) => [
		index("attachment_messageId_idx").on(self.messageId),
		index("attachment_userId_idx").on(self.userId),
	]
);
