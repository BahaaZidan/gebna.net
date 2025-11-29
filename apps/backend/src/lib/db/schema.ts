import { customType, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
	refreshHash: text().notNull(),
	userAgent: text(),
	ip: text(),
	createdAt: integer().notNull(),
	expiresAt: integer().notNull(),
	revoked: integer({ mode: "boolean" }).notNull().default(false),
});
