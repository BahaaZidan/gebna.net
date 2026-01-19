import { sql } from "drizzle-orm";
import {
	check,
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
	name: text().notNull(),
	avatar: text(),
	avatarPlaceholder: text().notNull(),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.default(sql`(strftime('%s','now'))`),
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

const IdentityKind = ["GEBNA_USER", "EXTERNAL_EMAIL"] as const;
type IdentityKind = (typeof IdentityKind)[number];
/** Identity (a global endpoint-like entity; today email-ish, later can grow handles) */
export const identityTable = sqliteTable(
	"identity",
	{
		id: text().primaryKey(),
		kind: text({ enum: IdentityKind }).notNull(),
		/** Canonical handle (currently email address). Case-insensitive via CITEXT. */
		address: citext().notNull().unique(),
		createdAt: integer({ mode: "timestamp" })
			.notNull()
			.default(sql`(strftime('%s','now'))`),
		name: text(),
		inferredAvatar: text(),
		avatarPlaceholder: text().notNull(),
	},
	(self) => [
		index("idx_identity_address").on(self.address),
		index("idx_identity_kind").on(self.kind),
	]
);

/** Viewer-scoped relationship (contacts) */
export const identityRelationshipTable = sqliteTable(
	"identity_relationship",
	{
		id: text().primaryKey(),
		ownerId: text()
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		identityId: text()
			.notNull()
			.references(() => identityTable.id, { onDelete: "cascade" }),
		isContact: integer({ mode: "boolean" }).notNull().default(false),
		updatedAt: integer({ mode: "timestamp" })
			.notNull()
			.default(sql`(strftime('%s','now'))`),
		createdAt: integer({ mode: "timestamp" })
			.notNull()
			.default(sql`(strftime('%s','now'))`),
		givenName: text(),
		uploadedAvatar: text(),
	},
	(self) => [
		uniqueIndex("uniq_identity_relationship_owner_identity").on(self.ownerId, self.identityId),
		index("idx_identity_relationship_owner_contact").on(self.ownerId, self.isContact),
	]
);

const ConversationKind = ["PRIVATE", "GROUP"] as const;
type ConversationKind = (typeof ConversationKind)[number];
export const conversationTable = sqliteTable(
	"conversation",
	{
		id: text().primaryKey(),
		kind: text({ enum: ConversationKind }).notNull(),
		title: text(),
		/**
		 * Deterministic key for PRIVATE conversations: "minIdentityId:maxIdentityId"
		 * Must be NULL for GROUP conversations.
		 */
		dmKey: text(),
		createdAt: integer({ mode: "timestamp" })
			.notNull()
			.default(sql`(strftime('%s','now'))`),
		updatedAt: integer({ mode: "timestamp" })
			.notNull()
			.default(sql`(strftime('%s','now'))`),
		lastMessageAt: integer({ mode: "timestamp" }).default(sql`(strftime('%s','now'))`),
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

const ParticipantRole = ["MEMBER", "ADMIN"] as const;
type ParticipantRole = (typeof ParticipantRole)[number];
const ParticipantState = ["ACTIVE", "LEFT"] as const;
type ParticipantState = (typeof ParticipantState)[number];
export const conversationParticipantTable = sqliteTable(
	"conversation_participant",
	{
		id: text().primaryKey(),
		conversationId: text()
			.notNull()
			.references(() => conversationTable.id, { onDelete: "cascade" }),
		identityId: text()
			.notNull()
			.references(() => identityTable.id, { onDelete: "cascade" }),
		role: text({ enum: ParticipantRole }).notNull(),
		state: text({ enum: ParticipantState }).notNull(),
		joinedAt: integer({ mode: "timestamp" })
			.notNull()
			.default(sql`(strftime('%s','now'))`),
		/**
		 * Per-participant read pointer. You can use a sentinel ID (e.g. "0") in app code.
		 */
		lastReadMessageId: text().references(() => messageTable.id, { onDelete: "set null" }),
	},
	(self) => [
		uniqueIndex("uniq_conversation_participant").on(self.conversationId, self.identityId),
		index("idx_conversation_participant_conversation").on(self.conversationId),
		index("idx_conversation_participant_identity").on(self.identityId),
	]
);

const Mailbox = ["IMPORTANT", "TRASH"] as const;
type Mailbox = (typeof Mailbox)[number];
export const conversationViewerStateTable = sqliteTable(
	"conversation_viewer_state",
	{
		id: text().primaryKey(),
		ownerId: text()
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		conversationId: text()
			.notNull()
			.references(() => conversationTable.id, { onDelete: "cascade" }),
		createdAt: integer({ mode: "timestamp" })
			.notNull()
			.default(sql`(strftime('%s','now'))`),
		updatedAt: integer({ mode: "timestamp" })
			.notNull()
			.default(sql`(strftime('%s','now'))`),
		mailbox: text({ enum: Mailbox }).notNull(),
		unreadCount: integer().notNull(),
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
export const messageTable = sqliteTable(
	"message",
	{
		id: text().primaryKey(),
		conversationId: text()
			.notNull()
			.references(() => conversationTable.id, { onDelete: "cascade" }),
		senderIdentityId: text()
			.notNull()
			.references(() => identityTable.id, { onDelete: "restrict" }),
		/**
		 * Normalized RFC5322 Message-Id for inbound email de-duping and threading.
		 * For non-email messages, this is NULL.
		 */
		externalMessageId: text(),
		bodyText: text(),
		bodyHTML: text(),
		createdAt: integer({ mode: "timestamp" })
			.notNull()
			.default(sql`(strftime('%s','now'))`),
		emailMetadata: text({ mode: "json" }).$type<EmailMetadata>(),
	},
	(self) => [
		uniqueIndex("uniq_message_external_message_id").on(self.externalMessageId),
		index("idx_message_conversation_created").on(self.conversationId, self.createdAt),
		index("idx_message_sender_created").on(self.senderIdentityId, self.createdAt),
	]
);

const DeliveryStatus = ["QUEUED", "SENT", "DELIVERED", "READ", "FAILED"] as const;
type DeliveryStatus = (typeof DeliveryStatus)[number];
const Transport = ["EMAIL", "GEBNA_DM"] as const;
type Transport = (typeof Transport)[number];
export const messageDeliveryTable = sqliteTable(
	"message_delivery",
	{
		id: text().primaryKey(),
		messageId: text()
			.notNull()
			.references(() => messageTable.id, { onDelete: "cascade" }),
		recipientIdentityId: text()
			.notNull()
			.references(() => identityTable.id, { onDelete: "cascade" }),
		status: text({ enum: DeliveryStatus }).notNull(),
		transport: text({ enum: Transport }).notNull(),
		latestStatusChangeAt: integer({ mode: "timestamp" })
			.notNull()
			.default(sql`(strftime('%s','now'))`),
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
