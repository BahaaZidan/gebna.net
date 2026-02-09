import type { ResultSet } from "@libsql/client";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import type { SQLiteTransaction } from "drizzle-orm/sqlite-core";

import * as schema from "./schema.js";

export { schema as dbSchema };

export const getDB = ({ url, authToken }: { url: string; authToken: string }) =>
	drizzle({
		schema,
		connection: { url, authToken },
	});

export type DBInstance = ReturnType<typeof getDB>;

export type TransactionInstance = SQLiteTransaction<
	"async",
	ResultSet,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;

export type UserSelectModel = typeof schema.userTable.$inferSelect;
export type UserInsertModel = typeof schema.userTable.$inferInsert;

export type IdentitySelectModel = typeof schema.identityTable.$inferSelect;
export type IdentityInsertModel = typeof schema.identityTable.$inferInsert;

export type IdentityRelationshipSelectModel = typeof schema.identityRelationshipTable.$inferSelect;
export type IdentityRelationshipInsertModel = typeof schema.identityRelationshipTable.$inferInsert;

export type ConversationSelectModel = typeof schema.conversationTable.$inferSelect;
export type ConversationInsertModel = typeof schema.conversationTable.$inferInsert;

export type ConversationParticipantSelectModel =
	typeof schema.conversationParticipantTable.$inferSelect;
export type ConversationParticipantInsertModel =
	typeof schema.conversationParticipantTable.$inferInsert;

export type ConversationViewerStateSelectModel =
	typeof schema.conversationViewerStateTable.$inferSelect;
export type ConversationViewerStateInsertModel =
	typeof schema.conversationViewerStateTable.$inferInsert;

export type MessageSelectModel = typeof schema.messageTable.$inferSelect;
export type MessageInsertModel = typeof schema.messageTable.$inferInsert;

export type MessageDeliverySelectModel = typeof schema.messageDeliveryTable.$inferSelect;
export type MessageDeliveryInsertModel = typeof schema.messageDeliveryTable.$inferInsert;
