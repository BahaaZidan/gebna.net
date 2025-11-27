import { getDB } from "../../db";
import { accountTable, userTable } from "../../db/schema";

export type UserAccountPair = {
	user: typeof userTable.$inferSelect;
	account: typeof accountTable.$inferSelect;
};

export async function loadUserWithPrimaryAccount(
	env: CloudflareBindings,
	userId: string
): Promise<UserAccountPair | null> {
	const db = getDB(env);
	const user = await db.query.userTable.findFirst({
		where: (table, { eq }) => eq(table.id, userId),
	});
	if (!user) {
		return null;
	}
	const account = await db.query.accountTable.findFirst({
		where: (table, { eq }) => eq(table.userId, user.id),
	});
	if (!account) {
		return null;
	}
	return { user, account };
}
