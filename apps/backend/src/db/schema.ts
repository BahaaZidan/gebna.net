import { desc } from "drizzle-orm";
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
		.references(() => userTable.id),
	refreshHash: text().notNull(),
	userAgent: text(),
	ip: text(),
	createdAt: integer().notNull(), // epoch seconds
	expiresAt: integer().notNull(), // epoch seconds
	revoked: integer({ mode: "boolean" }).notNull().default(false),
});

export const blobTable = sqliteTable("blob", {
	sha256: text().primaryKey(), // hex sha256 of the *full raw MIME*
	size: integer().notNull(),
});

export const messageTable = sqliteTable(
	"message",
	{
		id: text().primaryKey(), // ulid or cuid
		receiver: text()
			.notNull()
			.references(() => userTable.id), // FK -> your user table (must exist)
		receivedTimestamp: integer({ mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()), // received timestamp
		sentTimestamp: integer({ mode: "timestamp" }).notNull(), // sent timestamp

		messageIdHeader: text(), // "Message-Id" header (optional)
		subject: text(),
		fromRaw: text(), // raw From: header
		toRaw: text(), // raw To: header
		ccRaw: text(), // raw Cc: header (optional)
		bccRaw: text(),
		headersRaw: text(), // entire header block if you want

		// Content in R2
		rawSha256: text()
			.notNull()
			.references(() => blobTable.sha256), // integrity check + dedup
		size: integer().notNull().default(0),
		attachmentsPreview: text({ mode: "json" })
			.$type<ReadonlyArray<{ filename: string | null; mimeType: string }>>() // JSON
			.notNull()
			.default([]),

		// Optional plain-text snippet or preview
		snippet: text(),
	},
	(self) => [
		index("msg_user_date_idx").on(self.receiver, desc(self.receivedTimestamp)),
		// TO PREVENT PER USER DUPLICATES IN CASE THE MTA DECIDES TO RETRY ON A FALSE NEGATIVE
		uniqueIndex("msg_user_rawsha_uniq").on(self.receiver, self.rawSha256),
	]
);

export const attachmentTable = sqliteTable(
	"attachment",
	{
		id: text().primaryKey(),

		messageId: text()
			.notNull()
			.references(() => messageTable.id, { onDelete: "cascade" }),

		// Metadata as seen in headers
		filename: text(), // Content-Disposition filename / Content-Type name
		mime: text().notNull(), // e.g. "image/png", "application/pdf"
		size: integer().notNull(), // size of this part in bytes
		cid: text(), // Content-ID for inline resolution (cid:)
		disposition: text({ enum: ["inline", "attachment"] })
			.notNull()
			.default("attachment"),

		// Content-address pointer to R2 object (derived from sha256)
		sha256: text()
			.notNull()
			.references(() => blobTable.sha256),
	},
	(self) => [
		index("att_msg_idx").on(self.messageId),
		// Prevent duplicate attachment blobs on the same message
		uniqueIndex("att_msg_sha_uniq").on(self.messageId, self.sha256),
	]
);
