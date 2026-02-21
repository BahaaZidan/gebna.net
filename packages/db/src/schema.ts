import { ulid } from "@gebna/utils";
import { sql } from "drizzle-orm";
import {
	check,
	customType,
	foreignKey,
	index,
	integer,
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
type EmailConversationKind = (typeof EmailConversationKind)[number];
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
		/**
		 * * Deterministic key for PRIVATE conversations: "minEmailAddress:maxEmailAddress"
		 * * Must be NULL for GROUP conversations.
		 */
		dmKey: text(),
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
		unseenCount: integer().notNull(),
	},
	(self) => [
		uniqueIndex("uniq_idx_ownerId_dmKey").on(self.ownerId, self.dmKey),
		index("idx_conversation_ownerId_last_message_at").on(self.ownerId, self.lastMessageAt),
		check(
			"chk_conversation_dmkey_kind",
			sql`(
				(${self.kind} = 'PRIVATE' AND ${self.dmKey} IS NOT NULL AND length(${self.dmKey}) > 0)
				OR
				(${self.kind} = 'GROUP' AND ${self.dmKey} IS NULL)
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
		uniqueIndex("uniq_conversation_participant").on(self.conversationId, self.emailAddressRefId),
		index("idx_conversation_participant_conversation").on(self.conversationId),
		index("idx_conversation_participant_identity").on(self.emailAddressRefId),
	]
);

type EmailMetadata = {
	/** Headers.to */
	to: string[];
	/** Headers.cc */
	cc: string[];
	/** Headers.bcc */
	bcc: string[];
	/** Headers.replyTo ==> indicates the addresses to send the reply to that's possibly different from Envelope.from */
	replyTo: string[];
	/** Headers.inReplyTo ==> indicates the Email.messageId that this message is replying to */
	inReplyTo?: string;
	/** Headers.messageId ==> a unique identifier for the message. provided by the vendor */
	messageId?: string;
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
		bodySnippet: text(),
		bodyHTML: text(),
		createdAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		emailMetadata: text({ mode: "json" }).$type<EmailMetadata>(),
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
		index("idx_message_conversation_created").on(self.conversationId, self.createdAt),
	]
);
