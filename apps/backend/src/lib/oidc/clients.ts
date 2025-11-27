import type { DBInstance } from "../../db";
import { oidcClientTable } from "../../db/schema";

export type OidcClientRow = typeof oidcClientTable.$inferSelect;

export type OidcClient = OidcClientRow & {
	redirectUris: string[];
	allowedScopes: string[];
};

export function mapClientRow(row: OidcClientRow): OidcClient {
	const normalize = (value: unknown): string[] =>
		Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
	return {
		...row,
		redirectUris: normalize(row.redirectUrisJson),
		allowedScopes: normalize(row.allowedScopesJson),
	};
}

export async function findClientById(db: DBInstance, clientId: string): Promise<OidcClient | null> {
	const row = await db.query.oidcClientTable.findFirst({
		where: (table, { eq }) => eq(table.id, clientId),
	});
	return row ? mapClientRow(row) : null;
}
