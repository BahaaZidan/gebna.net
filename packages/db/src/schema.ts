import { ulid } from "@gebna/utils";
import { desc, sql } from "drizzle-orm";
import {
	blob,
	check,
	customType,
	foreignKey,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
	type AnySQLiteColumn,
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

export const users = sqliteTable("users", {
	id: text().primaryKey(),
	name: text().notNull(),
	email: citext().notNull().unique(),
	emailVerified: integer({ mode: "boolean" }).default(true).notNull(),
	image: text(),
	createdAt: integer({ mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer({ mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
	username: citext().unique().notNull(),
	displayUsername: text(),
	uploadedAvatar: text(),
	avatarPlaceholder: text().notNull(),
});

export const sessions = sqliteTable(
	"sessions",
	{
		id: text().primaryKey(),
		expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
		token: text().notNull().unique(),
		createdAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer({ mode: "timestamp_ms" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text(),
		userAgent: text(),
		userId: text()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
	},
	(table) => [index("sessions_userId_idx").on(table.userId)]
);

export const accounts = sqliteTable(
	"accounts",
	{
		id: text().primaryKey(),
		accountId: text().notNull(),
		providerId: text().notNull(),
		userId: text()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		accessToken: text(),
		refreshToken: text(),
		idToken: text(),
		accessTokenExpiresAt: integer({
			mode: "timestamp_ms",
		}),
		refreshTokenExpiresAt: integer({
			mode: "timestamp_ms",
		}),
		scope: text(),
		password: text(),
		createdAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer({ mode: "timestamp_ms" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("accounts_userId_idx").on(table.userId)]
);

export const verifications = sqliteTable(
	"verifications",
	{
		id: text().primaryKey(),
		identifier: text().notNull(),
		value: text().notNull(),
		expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
		createdAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verifications_identifier_idx").on(table.identifier)]
);

export const emailAddresses = sqliteTable("emailAddresses", {
	address: citext().primaryKey(),
	name: text(),
	inferredAvatar: text(),
	avatarPlaceholder: text().notNull(),
	createdAt: integer({ mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer({ mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const emailAddressRefs = sqliteTable(
	"emailAddressRefs",
	{
		id: text()
			.primaryKey()
			.$defaultFn(() => ulid()),
		ownerId: text()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		address: citext()
			.notNull()
			.references(() => emailAddresses.address, { onDelete: "cascade" }),
		createdAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		givenName: text(),
		givenAvatar: text(),
		isBlocked: integer({ mode: "boolean" }).notNull().default(false),
		isSpam: integer({ mode: "boolean" }).notNull().default(false),
	},
	(self) => [uniqueIndex("uniq_idx_ownerId_address").on(self.ownerId, self.address)]
);

export const EmailConversationKind = ["PRIVATE", "GROUP"] as const;
export type EmailConversationKind = (typeof EmailConversationKind)[number];
export const emailConversations = sqliteTable(
	"emailConversations",
	{
		id: text()
			.primaryKey()
			.$defaultFn(() => ulid()),
		ownerId: text()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		kind: text({ enum: EmailConversationKind }).notNull(),
		/** Deterministic key for PRIVATE conversations: "minEmailAddress:maxEmailAddress" */
		privateConvoKey: citext(),
		title: text(),
		createdAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		lastMessageId: text().references((): AnySQLiteColumn => emailMessages.id, {
			onDelete: "set null",
		}),
		lastMessageAt: integer({ mode: "timestamp_ms" }).default(
			sql`(cast(unixepoch('subsecond') * 1000 as integer))`
		),
		uploadedAvatar: text(),
		unseenCount: integer().notNull().default(0),
	},
	(self) => [
		uniqueIndex("uniq_idx_ownerId_dmKey").on(self.ownerId, self.privateConvoKey),
		index("idx_conversation_ownerId_last_message_at").on(self.ownerId, self.lastMessageAt),
		check(
			"chk_conversation_dmkey_kind",
			sql`(
				(${self.kind} = 'PRIVATE' AND ${self.privateConvoKey} IS NOT NULL AND length(${self.privateConvoKey}) > 0)
				OR
				(${self.kind} = 'GROUP' AND ${self.privateConvoKey} IS NULL)
			)`
		),
	]
);

export const emailConversationParticipants = sqliteTable(
	"emailConversationParticipants",
	{
		conversationId: text()
			.notNull()
			.references(() => emailConversations.id, { onDelete: "cascade" }),
		emailAddressRefId: text()
			.notNull()
			.references(() => emailAddressRefs.id, { onDelete: "cascade" }),
	},
	(self) => [
		primaryKey({ columns: [self.conversationId, self.emailAddressRefId] }),
		index("idx_conversation_participant_conversation").on(self.conversationId),
		index("idx_conversation_participant_identity").on(self.emailAddressRefId),
	]
);

export type EmailMessageMetadataAddress = {
	address: string;
	name: string;
};
export type EmailMessageMetadata = {
	/** Headers.to */
	to: EmailMessageMetadataAddress[];
	/** Headers.cc */
	cc: EmailMessageMetadataAddress[];
	/** Headers.bcc */
	bcc: EmailMessageMetadataAddress[];
	/** Headers.replyTo ==> indicates the addresses to send the reply to that's possibly different from Envelope.from */
	replyTo: EmailMessageMetadataAddress[];
	/** Headers.inReplyTo ==> indicates the Email.messageId that this message is replying to */
	inReplyTo?: string;
	/** Headers.references ==> It lists the entire ancestry of the conversation — all the Message-IDs leading up to this email. used for threading */
	references?: string;
};
export const emailMessages = sqliteTable(
	"emailMessages",
	{
		id: text()
			.primaryKey()
			.$defaultFn(() => ulid()),
		ownerId: text()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/**
		 * Normalized RFC5322 Message-Id for inbound email de-duping and threading.
		 * * For in-bound it's provided by the vendor or null
		 * * For out-bound it's null and `self.id` is provided in the headers instead
		 */
		canonicalMessageId: text(),
		conversationId: text()
			.notNull()
			.references((): AnySQLiteColumn => emailConversations.id, { onDelete: "cascade" }),
		from: citext().notNull(),
		to: citext().notNull(),
		bodyPlaintext: text(),
		bodyHTML: text(),
		createdAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		metadata: text({ mode: "json" }).$type<EmailMessageMetadata>(),
		/** Size of the whole Envelope */
		sizeInBytes: integer().notNull(),
		unseen: integer({ mode: "boolean" }).notNull().default(true),
	},
	(self) => [
		foreignKey({
			name: "fk_emailMessages_from_ref",
			columns: [self.ownerId, self.from],
			foreignColumns: [emailAddressRefs.ownerId, emailAddressRefs.address],
		}).onDelete("cascade"),
		foreignKey({
			name: "fk_emailMessages_to_ref",
			columns: [self.ownerId, self.to],
			foreignColumns: [emailAddressRefs.ownerId, emailAddressRefs.address],
		}).onDelete("cascade"),
		uniqueIndex("uniq_idx_message_canonical_message_id").on(self.ownerId, self.canonicalMessageId),
		index("idx_message_conversation_created").on(self.conversationId, desc(self.createdAt)),
	]
);

export const EmailAttachmentDisposition = ["attachment", "inline"] as const;
type EmailAttachmentDisposition = (typeof EmailAttachmentDisposition)[number];
export const emailAttachments = sqliteTable("emailAttachments", {
	id: text()
		.primaryKey()
		.$defaultFn(() => ulid()),
	ownerId: text()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	messageId: text()
		.notNull()
		.references(() => emailMessages.id, { onDelete: "cascade" }),
	conversationId: text()
		.notNull()
		.references(() => emailConversations.id, { onDelete: "cascade" }),
	fromRef: text()
		.notNull()
		.references(() => emailAddressRefs.id, { onDelete: "cascade" }),
	filename: text(),
	mimeType: text(),
	disposition: text({ enum: EmailAttachmentDisposition }),
	related: integer({ mode: "boolean" }),
	description: text(),
	contentId: text(),
	method: text(),
	content: blob().notNull(),
});
