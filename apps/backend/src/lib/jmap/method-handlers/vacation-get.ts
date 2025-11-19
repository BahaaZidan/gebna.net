import { eq } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { vacationResponseTable } from "../../../db/schema";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState } from "../utils";

type VacationRecord = {
	id: string;
	isEnabled: boolean;
	fromDate: string | null;
	toDate: string | null;
	subject: string | null;
	textBody: string | null;
	htmlBody: string | null;
};

function dateToIso(value: number | Date | null | undefined): string | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString();
}

export async function handleVacationResponseGet(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse> {
	const db = getDB(c.env);
	const accountIdArg = args.accountId as string | undefined;
	const effectiveAccountId = ensureAccountAccess(c, accountIdArg);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const state = await getAccountState(db, effectiveAccountId, "VacationResponse");

	const [row] = await db
		.select({
			isEnabled: vacationResponseTable.isEnabled,
			fromDate: vacationResponseTable.fromDate,
			toDate: vacationResponseTable.toDate,
			subject: vacationResponseTable.subject,
			textBody: vacationResponseTable.textBody,
			htmlBody: vacationResponseTable.htmlBody,
		})
		.from(vacationResponseTable)
		.where(eq(vacationResponseTable.accountId, effectiveAccountId))
		.limit(1);

	const record: VacationRecord = {
		id: "singleton",
		isEnabled: Boolean(row?.isEnabled ?? false),
		fromDate: dateToIso(row?.fromDate ?? null),
		toDate: dateToIso(row?.toDate ?? null),
		subject: row?.subject ?? null,
		textBody: row?.textBody ?? null,
		htmlBody: row?.htmlBody ?? null,
	};

	return [
		"VacationResponse/get",
		{
			accountId: effectiveAccountId,
			state,
			list: [record],
			notFound: [],
		},
		tag,
	];
}
