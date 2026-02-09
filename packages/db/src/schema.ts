import { relations, sql } from "drizzle-orm";
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
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
	username: citext("username").unique().notNull(),
	displayUsername: text("display_username"),
	uploadedAvatar: text(),
	avatarPlaceholder: text().notNull(),
});

export const userRelations = relations(userTable, ({ one, many }) => ({
	sessions: many(sessionTable),
	accounts: many(accountTable),
	relations: many(identityRelationshipTable),
	identity: one(identityTable, {
		fields: [userTable.id],
		references: [identityTable.ownerId],
	}),
}));

export const sessionTable = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
	},
	(self) => [index("session_userId_idx").on(self.userId)]
);

export const sessionRelations = relations(sessionTable, ({ one }) => ({
	user: one(userTable, {
		fields: [sessionTable.userId],
		references: [userTable.id],
	}),
}));

export const accountTable = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", {
			mode: "timestamp_ms",
		}),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", {
			mode: "timestamp_ms",
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(self) => [index("account_userId_idx").on(self.userId)]
);

export const accountRelations = relations(accountTable, ({ one }) => ({
	user: one(userTable, {
		fields: [accountTable.userId],
		references: [userTable.id],
	}),
}));

export const verificationTable = sqliteTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(self) => [index("verification_identifier_idx").on(self.identifier)]
);

const IdentityKind = ["GEBNA_USER", "EXTERNAL_EMAIL"] as const;
type IdentityKind = (typeof IdentityKind)[number];
/** Identity (a global endpoint-like entity; today email-ish, later can grow handles) */
export const identityTable = sqliteTable(
	"identity",
	{
		id: text().primaryKey(),
		ownerId: text()
			.unique()
			.references(() => userTable.id, { onDelete: "cascade" }),
		kind: text({ enum: IdentityKind }).notNull(),
		/** Canonical handle (currently email address). Case-insensitive via CITEXT. */
		address: citext().notNull().unique(),
		createdAt: integer({ mode: "timestamp" })
			.notNull()
			.default(sql`(strftime('%s','now'))`),
		updatedAt: integer({ mode: "timestamp" })
			.notNull()
			.default(sql`(strftime('%s','now'))`)
			.$onUpdate(() => sql`(strftime('%s','now'))`),
		name: text(),
		inferredAvatar: text(),
		avatarPlaceholder: text().notNull(),
	},
	(self) => [
		index("idx_identity_address").on(self.address),
		index("idx_identity_kind").on(self.kind),
	]
);

export const identityRelations = relations(identityTable, ({ one, many }) => ({
	owner: one(userTable, {
		fields: [identityTable.ownerId],
		references: [userTable.id],
	}),
	relations: many(identityRelationshipTable),
	participations: many(conversationParticipantTable),
}));

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
			.default(sql`(strftime('%s','now'))`)
			.$onUpdate(() => sql`(strftime('%s','now'))`),
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

export const identityRelationshipRelations = relations(identityRelationshipTable, ({ one }) => ({
	owner: one(userTable, {
		fields: [identityRelationshipTable.ownerId],
		references: [userTable.id],
	}),
	identity: one(identityTable, {
		fields: [identityRelationshipTable.identityId],
		references: [identityTable.id],
	}),
}));

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
			.default(sql`(strftime('%s','now'))`)
			.$onUpdate(() => sql`(strftime('%s','now'))`),
		lastMessageAt: integer({ mode: "timestamp" }).default(sql`(strftime('%s','now'))`),
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

export const conversationRelations = relations(conversationTable, ({ many }) => ({
	participants: many(conversationParticipantTable),
}));

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
		ownerId: text().references(() => userTable.id, { onDelete: "cascade" }),
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

export const conversationParticipantRelations = relations(
	conversationParticipantTable,
	({ one }) => ({
		conversation: one(conversationTable, {
			fields: [conversationParticipantTable.conversationId],
			references: [conversationTable.id],
		}),
		identity: one(identityTable, {
			fields: [conversationParticipantTable.identityId],
			references: [identityTable.id],
		}),
		owner: one(userTable, {
			fields: [conversationParticipantTable.ownerId],
			references: [userTable.id],
		}),
	})
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
			.default(sql`(strftime('%s','now'))`)
			.$onUpdate(() => sql`(strftime('%s','now'))`),
		mailbox: text({ enum: Mailbox }).notNull(),
		unreadCount: integer().notNull(),
	},
	(self) => [
		uniqueIndex("uniq_conversation_viewer_state").on(self.ownerId, self.conversationId),
		index("idx_conversation_viewer_state_owner_mailbox").on(self.ownerId, self.mailbox),
		index("idx_conversation_viewer_state_owner_updated").on(self.ownerId, self.updatedAt),
	]
);

export const conversationViewerStateRelations = relations(
	conversationViewerStateTable,
	({ one }) => ({
		owner: one(userTable, {
			fields: [conversationViewerStateTable.ownerId],
			references: [userTable.id],
		}),
		conversation: one(conversationTable, {
			fields: [conversationViewerStateTable.conversationId],
			references: [conversationTable.id],
		}),
	})
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
		bodyMD: text(),
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

export const messageRelations = relations(messageTable, ({ one }) => ({
	conversation: one(conversationTable, {
		fields: [messageTable.conversationId],
		references: [conversationTable.id],
	}),
	senderIdentity: one(identityTable, {
		fields: [messageTable.senderIdentityId],
		references: [identityTable.id],
	}),
}));

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

export const messageDeliveryRelations = relations(messageDeliveryTable, ({ one }) => ({
	message: one(messageTable, {
		fields: [messageDeliveryTable.messageId],
		references: [messageTable.id],
	}),
	recipientIdentity: one(identityTable, {
		fields: [messageDeliveryTable.recipientIdentityId],
		references: [identityTable.id],
	}),
}));
