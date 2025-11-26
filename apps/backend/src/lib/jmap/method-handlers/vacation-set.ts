import { eq } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import { vacationResponseTable } from "../../../db/schema";
import { recordUpdate } from "../change-log";
import { JMAPHonoAppEnv } from "../middlewares";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState, isRecord } from "../utils";

type VacationPatch = {
	isEnabled?: boolean;
	fromDate?: Date | null;
	toDate?: Date | null;
	subject?: string | null;
	textBody?: string | null;
	htmlBody?: string | null;
};

class VacationSetProblem extends Error {
	readonly type: string;

	constructor(type: string, message: string) {
		super(message);
		this.type = type;
	}
}

function parseDateString(value: unknown, field: string): Date | null {
	if (value === null) return null;
	if (typeof value === "string") {
		if (value.length === 0) return null;
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) {
			throw new VacationSetProblem("invalidProperties", `${field} must be an ISO 8601 string`);
		}
		return d;
	}
	throw new VacationSetProblem("invalidProperties", `${field} must be a string or null`);
}

function parseVacationPatch(raw: unknown): VacationPatch {
	if (!isRecord(raw)) {
		throw new VacationSetProblem("invalidProperties", "VacationResponse patch must be an object");
	}

	const patch: VacationPatch = {};

	if (raw.isEnabled !== undefined) {
		if (typeof raw.isEnabled !== "boolean") {
			throw new VacationSetProblem("invalidProperties", "isEnabled must be boolean");
		}
		patch.isEnabled = raw.isEnabled;
	}

	if (raw.fromDate !== undefined) {
		patch.fromDate = raw.fromDate === null ? null : parseDateString(raw.fromDate, "fromDate");
	}

	if (raw.toDate !== undefined) {
		patch.toDate = raw.toDate === null ? null : parseDateString(raw.toDate, "toDate");
	}

	if (raw.subject !== undefined) {
		if (raw.subject !== null && typeof raw.subject !== "string") {
			throw new VacationSetProblem("invalidProperties", "subject must be string or null");
		}
		patch.subject = raw.subject;
	}

	if (raw.textBody !== undefined) {
		if (raw.textBody !== null && typeof raw.textBody !== "string") {
			throw new VacationSetProblem("invalidProperties", "textBody must be string or null");
		}
		patch.textBody = raw.textBody;
	}

	if (raw.htmlBody !== undefined) {
		if (raw.htmlBody !== null && typeof raw.htmlBody !== "string") {
			throw new VacationSetProblem("invalidProperties", "htmlBody must be string or null");
		}
		patch.htmlBody = raw.htmlBody;
	}

	return patch;
}

export async function handleVacationResponseSet(
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

	const oldState = await getAccountState(db, effectiveAccountId, "VacationResponse");
	const ifInState = args.ifInState as string | undefined;
	if (ifInState && ifInState !== oldState) {
		return ["error", { type: "stateMismatch" }, tag];
	}

	if (args.create && Object.keys(args.create as Record<string, unknown>).length > 0) {
		return ["error", { type: "invalidArguments", description: "VacationResponse cannot be created" }, tag];
	}

	if (args.destroy && (args.destroy as unknown[]).length > 0) {
		return ["error", { type: "invalidArguments", description: "VacationResponse cannot be destroyed" }, tag];
	}

	const updateMap = (args.update as Record<string, unknown> | undefined) ?? {};
	const patchRaw = updateMap["singleton"];
	if (patchRaw === undefined) {
		return ["error", { type: "invalidArguments", description: "VacationResponse requires singleton update" }, tag];
	}

	let patch: VacationPatch;
	try {
		patch = parseVacationPatch(patchRaw);
	} catch (err) {
		if (err instanceof VacationSetProblem) {
			return ["error", { type: err.type, description: err.message }, tag];
		}
		throw err;
	}
	if (Object.keys(patch).length === 0) {
		return ["error", { type: "invalidArguments", description: "No properties to update" }, tag];
	}

	const now = new Date();

	let didChange = false;
	let updatedProperties: string[] | null = null;
	await db.transaction(async (tx) => {
		const [existing] = await tx
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

		if (!existing) {
			await tx.insert(vacationResponseTable).values({
				accountId: effectiveAccountId,
				isEnabled: patch.isEnabled ?? false,
				fromDate: patch.fromDate ?? null,
				toDate: patch.toDate ?? null,
				subject: patch.subject ?? null,
				textBody: patch.textBody ?? null,
				htmlBody: patch.htmlBody ?? null,
				createdAt: now,
				updatedAt: now,
			});
			didChange = true;
			updatedProperties = ["isEnabled", "fromDate", "toDate", "subject", "textBody", "htmlBody"];
		} else {
			const updateSet: Record<string, unknown> = {};
			if (patch.isEnabled !== undefined && patch.isEnabled !== Boolean(existing.isEnabled)) {
				updateSet.isEnabled = patch.isEnabled;
			}
			if (patch.fromDate !== undefined) {
				updateSet.fromDate = patch.fromDate;
			}
			if (patch.toDate !== undefined) {
				updateSet.toDate = patch.toDate;
			}
			if (patch.subject !== undefined && patch.subject !== existing.subject) {
				updateSet.subject = patch.subject;
			}
			if (patch.textBody !== undefined && patch.textBody !== existing.textBody) {
				updateSet.textBody = patch.textBody;
			}
			if (patch.htmlBody !== undefined && patch.htmlBody !== existing.htmlBody) {
				updateSet.htmlBody = patch.htmlBody;
			}

			if (Object.keys(updateSet).length > 0) {
				updateSet.updatedAt = now;
				await tx
					.update(vacationResponseTable)
					.set(updateSet)
					.where(eq(vacationResponseTable.accountId, effectiveAccountId));
				didChange = true;
				updatedProperties = Object.keys(updateSet).filter((key) => key !== "updatedAt");
			}
		}

		if (didChange) {
			await recordUpdate(tx, {
				accountId: effectiveAccountId,
				type: "VacationResponse",
				objectId: "singleton",
				now,
				updatedProperties: updatedProperties,
			});
		}
	});

	if (!didChange) {
		return [
			"VacationResponse/set",
			{
				accountId: effectiveAccountId,
				oldState,
				newState: oldState,
				updated: {},
				notUpdated: { singleton: { type: "invalidProperties", description: "No changes applied" } },
				created: {},
				notCreated: {},
				destroyed: [],
				notDestroyed: {},
			},
			tag,
		];
	}

	const newState = await getAccountState(db, effectiveAccountId, "VacationResponse");

	return [
		"VacationResponse/set",
		{
			accountId: effectiveAccountId,
			oldState,
			newState,
			updated: { singleton: { id: "singleton" } },
			notUpdated: {},
			created: {},
			notCreated: {},
			destroyed: [],
			notDestroyed: {},
		},
		tag,
	];
}
