import { sql } from "drizzle-orm";
import {
	check,
	customType,
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

const IdentityKind = ["INTERNAL", "EXTERNAL"] as const;
type IdentityKind = (typeof IdentityKind)[number];
/** Identity (a global endpoint-like entity; today email-ish, later can grow handles) */
export const identities = sqliteTable(
	"identities",
	{
		id: text().primaryKey(),
		ownerId: text()
			.unique()
			.references(() => users.id, { onDelete: "cascade" }),
		kind: text({ enum: IdentityKind }).notNull(),
		/** Canonical handle (currently email address). Case-insensitive via CITEXT. */
		address: citext().notNull().unique(),
		createdAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		name: text(),
		inferredAvatar: text(),
		avatarPlaceholder: text().notNull(),
	},
	(self) => [
		index("idx_identities_address").on(self.address),
		check(
			"chk_identities_ownerId_matches_kind",
			sql`(
        (${self.kind} = 'INTERNAL' AND ${self.ownerId} IS NOT NULL)
        OR
        (${self.kind} = 'EXTERNAL' AND ${self.ownerId} IS NULL)
      )`
		),
	]
);

/** Viewer-scoped relationship (contacts) */
export const identityRelationships = sqliteTable(
	"identityRelationships",
	{
		id: text().primaryKey(),
		ownerId: text()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		identityId: text()
			.notNull()
			.references(() => identities.id, { onDelete: "cascade" }),
		isContact: integer({ mode: "boolean" }).notNull().default(false),
		createdAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		givenName: text(),
		uploadedAvatar: text(),
	},
	(self) => [
		uniqueIndex("uniq_identity_relationship_owner_identity").on(self.ownerId, self.identityId),
		index("idx_identity_relationship_owner_contact").on(self.ownerId, self.isContact),
	]
);

export const ConversationKind = ["PRIVATE", "GROUP"] as const;
type ConversationKind = (typeof ConversationKind)[number];
export const conversations = sqliteTable(
	"conversations",
	{
		id: text().primaryKey(),
		kind: text({ enum: ConversationKind }).notNull(),
		title: text(),
		/**
		 * Deterministic key for PRIVATE conversations: "minIdentityId:maxIdentityId"
		 * Must be NULL for GROUP conversations.
		 */
		dmKey: text(),
		createdAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		lastMessageId: text().references((): AnySQLiteColumn => messages.id, {
			onDelete: "set null",
		}),
		lastMessageAt: integer({ mode: "timestamp_ms" }).default(
			sql`(cast(unixepoch('subsecond') * 1000 as integer))`
		),
		uploadedAvatar: text(),
	},
	(self) => [
		uniqueIndex("uniq_conversation_dm_key").on(self.dmKey),
		index("idx_conversation_kind_updated").on(self.kind, self.updatedAt),
		index("idx_conversation_last_message_at").on(self.lastMessageAt),
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

export const ParticipantRole = ["MEMBER", "ADMIN"] as const;
type ParticipantRole = (typeof ParticipantRole)[number];
export const ParticipantState = ["ACTIVE", "LEFT"] as const;
type ParticipantState = (typeof ParticipantState)[number];
export const conversationParticipants = sqliteTable(
	"conversationParticipants",
	{
		id: text().primaryKey(),
		conversationId: text()
			.notNull()
			.references(() => conversations.id, { onDelete: "cascade" }),
		identityId: text()
			.notNull()
			.references(() => identities.id, { onDelete: "cascade" }),
		ownerId: text().references(() => users.id, { onDelete: "cascade" }),
		role: text({ enum: ParticipantRole }).notNull(),
		state: text({ enum: ParticipantState }).notNull(),
		joinedAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		/**
		 * Per-participant seen pointer. You can use a sentinel ID (e.g. "0") in app code.
		 */
		lastSeenMessageId: text().references(() => messages.id, { onDelete: "set null" }),
	},
	(self) => [
		uniqueIndex("uniq_conversation_participant").on(self.conversationId, self.identityId),
		index("idx_conversation_participant_conversation").on(self.conversationId),
		index("idx_conversation_participant_identity").on(self.identityId),
	]
);

export const Mailbox = ["IMPORTANT", "TRASH"] as const;
type Mailbox = (typeof Mailbox)[number];
export const conversationViewerStates = sqliteTable(
	"conversationViewerStates",
	{
		id: text().primaryKey(),
		ownerId: text()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		conversationId: text()
			.notNull()
			.references(() => conversations.id, { onDelete: "cascade" }),
		createdAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		mailbox: text({ enum: Mailbox }).notNull(),
		unseenCount: integer().notNull(),
	},
	(self) => [
		uniqueIndex("uniq_conversation_viewer_state").on(self.ownerId, self.conversationId),
		index("idx_conversation_viewer_state_owner_mailbox").on(self.ownerId, self.mailbox),
		index("idx_conversation_viewer_state_owner_updated").on(self.ownerId, self.updatedAt),
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
export const messages = sqliteTable(
	"messages",
	{
		id: text().primaryKey(),
		conversationId: text()
			.notNull()
			.references((): AnySQLiteColumn => conversations.id, { onDelete: "cascade" }),
		senderIdentityId: text()
			.notNull()
			.references(() => identities.id, { onDelete: "restrict" }),
		/**
		 * Normalized RFC5322 Message-Id for inbound email de-duping and threading.
		 * For non-email messages, this is NULL.
		 */
		externalMessageId: text(),
		bodyPlainText: text(),
		bodyPlainTextSnippet: text(),
		/** From the email envelope. only available from external inbound email messages */
		bodyRawHTML: text(),
		hasBodyRawHTML: integer({ mode: "boolean" }).default(false),
		/** Can be sourced from the rawHTML in case of external inbound or straight from input for internal outbound */
		bodyMD: text(),
		/** `self.bodyMD` transformed into HTML to facilatate rendering */
		bodyHTMLFromMD: text(),
		createdAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer({ mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		emailMetadata: text({ mode: "json" }).$type<EmailMetadata>(),
	},
	(self) => [
		uniqueIndex("uniq_message_external_message_id").on(self.externalMessageId),
		index("idx_message_conversation_created").on(self.conversationId, self.createdAt),
		index("idx_message_sender_created").on(self.senderIdentityId, self.createdAt),
	]
);

const DeliveryStatus = ["QUEUED", "SENT", "DELIVERED", "SEEN", "FAILED"] as const;
type DeliveryStatus = (typeof DeliveryStatus)[number];
export const Transport = ["EMAIL", "DIRECT"] as const;
type Transport = (typeof Transport)[number];
export const messageDeliveries = sqliteTable(
	"messageDeliveries",
	{
		id: text().primaryKey(),
		messageId: text()
			.notNull()
			.references(() => messages.id, { onDelete: "cascade" }),
		recipientIdentityId: text()
			.notNull()
			.references(() => identities.id, { onDelete: "cascade" }),
		transport: text({ enum: Transport }).notNull(),
		status: text({ enum: DeliveryStatus }).notNull(),
		latestStatusChangeAt: integer({ mode: "timestamp_ms" })
			.notNull()
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
		error: text(),
	},
	(self) => [
		uniqueIndex("uniq_message_delivery_message_recipient").on(
			self.messageId,
			self.recipientIdentityId
		),
		index("idx_message_delivery_message").on(self.messageId),
		index("idx_message_delivery_recipient_status").on(self.recipientIdentityId, self.status),
	]
);
