import { desc } from "drizzle-orm";
import { customType, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
		// rawR2Key: text().notNull(), // R2 key for full raw MIME
		// rawSha256: text().notNull(), // integrity check + dedup
		size: integer().notNull().default(0),
		// hasAttachment: integer({ mode: "boolean" }).notNull().default(false),

		// Optional plain-text snippet or preview
		snippet: text(),
	},
	(self) => [
		index("msg_user_date_idx").on(self.receiver, desc(self.receivedTimestamp)),
		// uniqueIndex("msg_user_rawsha_uniq").on(self.receiver, self.rawSha256),
	]
);
