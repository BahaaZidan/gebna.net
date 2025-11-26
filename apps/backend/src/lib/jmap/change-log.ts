import { eq, sql } from "drizzle-orm";

import { type DBInstance, type TransactionInstance } from "../../db";
import {
	changeLogTable,
	jmapStateTable,
	type ChangeLogOp,
	type ChangeLogType,
} from "../../db/schema";
import type { JmapStateType } from "./types";

const THREAD_EMAIL_ID_PROPS = ["emailIds"] as const;
const MAILBOX_COUNT_PROPS = ["totalEmails", "totalThreads", "unreadEmails", "unreadThreads"] as const;

type DBLike = DBInstance | TransactionInstance;

type ChangeLogParamsBase = {
	accountId: string;
	type: ChangeLogType;
	objectId: string;
	stateTypes?: readonly JmapStateType[];
	now?: Date;
	updatedProperties?: readonly string[] | null;
};

type ChangeLogParams = ChangeLogParamsBase & {
	op: ChangeLogOp;
};

function normalizeUpdatedProperties(
	props?: readonly string[] | null
): string[] | null {
	if (!props || props.length === 0) {
		return null;
	}
	const seen = new Set<string>();
	const normalized: string[] = [];
	for (const prop of props) {
		if (typeof prop !== "string") continue;
		const trimmed = prop.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		normalized.push(trimmed);
	}
	return normalized.length ? normalized : null;
}

function serializeUpdatedProperties(
	props?: readonly string[] | null
): string | null {
	const normalized = normalizeUpdatedProperties(props);
	return normalized ? JSON.stringify(normalized) : null;
}

async function getNextModSeq(db: DBLike, accountId: string): Promise<number> {
	const rows = await db
		.select({ modSeq: jmapStateTable.modSeq })
		.from(jmapStateTable)
		.where(eq(jmapStateTable.accountId, accountId));

	if (!rows.length) return 1;

	let max = rows[0]!.modSeq;
	for (const row of rows) {
		if (row.modSeq > max) max = row.modSeq;
	}
	return max + 1;
}

async function updateStateRows(
	db: DBLike,
	accountId: string,
	stateTypes: readonly JmapStateType[],
	modSeq: number
): Promise<void> {
	for (const type of stateTypes) {
		await db
			.insert(jmapStateTable)
			.values({ accountId, type, modSeq })
			.onConflictDoUpdate({
				target: [jmapStateTable.accountId, jmapStateTable.type],
				set: { modSeq },
			});
	}
}

function defaultStateTypesForChangeType(type: ChangeLogType): readonly JmapStateType[] {
	// ChangeLogType and JmapStateType currently share the same string literals
	return [type as JmapStateType];
}

export async function recordChange(db: DBLike, params: ChangeLogParams): Promise<number> {
	const { accountId, type, objectId, op, now, stateTypes, updatedProperties } = params;

	const modSeq = await getNextModSeq(db, accountId);
	const affectedTypes =
		stateTypes && stateTypes.length > 0 ? stateTypes : defaultStateTypesForChangeType(type);

	const createdAt = now ?? new Date();

	await db.insert(changeLogTable).values({
		id: crypto.randomUUID(),
		accountId,
		type,
		objectId,
		op,
		modSeq,
		updatedPropertiesJson: serializeUpdatedProperties(updatedProperties),
		createdAt,
	});

	await updateStateRows(db, accountId, affectedTypes, modSeq);

	return modSeq;
}

export async function recordCreate(db: DBLike, params: ChangeLogParamsBase): Promise<number> {
	return recordChange(db, { ...params, op: "create" });
}

export async function recordUpdate(db: DBLike, params: ChangeLogParamsBase): Promise<number> {
	return recordChange(db, { ...params, op: "update" });
}

export async function recordDestroy(db: DBLike, params: ChangeLogParamsBase): Promise<number> {
	return recordChange(db, { ...params, op: "destroy" });
}

/**
 * Convenience helper if you ever need the current global state string
 * from inside a handler without re-implementing the logic from jmap.routes.
 */
export async function getGlobalAccountStateString(db: DBLike, accountId: string): Promise<string> {
	const rows = await db
		.select({ modSeq: jmapStateTable.modSeq })
		.from(jmapStateTable)
		.where(eq(jmapStateTable.accountId, accountId));

	if (!rows.length) return "0";

	let max = rows[0]!.modSeq;
	for (const row of rows) {
		if (row.modSeq > max) max = row.modSeq;
	}
	return String(max);
}

type EmailChangeParams = {
	tx: DBLike;
	accountId: string;
	accountMessageId: string;
	threadId: string;
	mailboxIds: string[];
	now: Date;
	emailUpdatedProperties?: readonly string[] | null;
	threadUpdatedProperties?: readonly string[] | null;
};

async function bumpStateTx(
	db: DBLike,
	accountId: string,
	type: JmapStateType
): Promise<number> {
	const [row] = await db
		.insert(jmapStateTable)
		.values({
			accountId,
			type,
			modSeq: 1,
		})
		.onConflictDoUpdate({
			target: [jmapStateTable.accountId, jmapStateTable.type],
			set: { modSeq: sql`${jmapStateTable.modSeq} + 1` },
		})
		.returning({ modSeq: jmapStateTable.modSeq });

	return row.modSeq;
}

export async function recordEmailCreateChanges(params: EmailChangeParams): Promise<void> {
	const { tx, accountId, accountMessageId, threadId, mailboxIds, now } = params;

	const emailModSeq = await bumpStateTx(tx, accountId, "Email");
	await tx.insert(changeLogTable).values({
		id: crypto.randomUUID(),
		accountId,
		type: "Email",
		objectId: accountMessageId,
		op: "create",
		modSeq: emailModSeq,
		updatedPropertiesJson: null,
		createdAt: now,
	});

	const threadModSeq = await bumpStateTx(tx, accountId, "Thread");
	await tx.insert(changeLogTable).values({
		id: crypto.randomUUID(),
		accountId,
		type: "Thread",
		objectId: threadId,
		op: "create",
		modSeq: threadModSeq,
		updatedPropertiesJson: null,
		createdAt: now,
	});

	if (mailboxIds.length > 0) {
		const mailboxModSeq = await bumpStateTx(tx, accountId, "Mailbox");
		for (const mailboxId of mailboxIds) {
			await tx.insert(changeLogTable).values({
				id: crypto.randomUUID(),
				accountId,
				type: "Mailbox",
				objectId: mailboxId,
				op: "create",
				modSeq: mailboxModSeq,
				updatedPropertiesJson: serializeUpdatedProperties(MAILBOX_COUNT_PROPS),
				createdAt: now,
			});
		}
	}
}

export async function recordEmailUpdateChanges(params: EmailChangeParams): Promise<void> {
	const {
		tx,
		accountId,
		accountMessageId,
		threadId,
		mailboxIds,
		now,
		emailUpdatedProperties,
		threadUpdatedProperties,
	} = params;

	const emailModSeq = await bumpStateTx(tx, accountId, "Email");
	await tx.insert(changeLogTable).values({
		id: crypto.randomUUID(),
		accountId,
		type: "Email",
		objectId: accountMessageId,
		op: "update",
		modSeq: emailModSeq,
		updatedPropertiesJson: serializeUpdatedProperties(emailUpdatedProperties ?? null),
		createdAt: now,
	});

	const threadModSeq = await bumpStateTx(tx, accountId, "Thread");
	await tx.insert(changeLogTable).values({
		id: crypto.randomUUID(),
		accountId,
		type: "Thread",
		objectId: threadId,
		op: "update",
		modSeq: threadModSeq,
		updatedPropertiesJson: serializeUpdatedProperties(threadUpdatedProperties ?? null),
		createdAt: now,
	});

	if (mailboxIds.length > 0) {
		const mailboxModSeq = await bumpStateTx(tx, accountId, "Mailbox");
		for (const mailboxId of mailboxIds) {
			await tx.insert(changeLogTable).values({
				id: crypto.randomUUID(),
				accountId,
				type: "Mailbox",
				objectId: mailboxId,
				op: "update",
				modSeq: mailboxModSeq,
				updatedPropertiesJson: serializeUpdatedProperties(MAILBOX_COUNT_PROPS),
				createdAt: now,
			});
		}
	}
}

type EmailDestroyChangeParams = EmailChangeParams & {
	threadStillExists: boolean;
};

export async function recordEmailDestroyChanges(params: EmailDestroyChangeParams): Promise<void> {
	const {
		tx,
		accountId,
		accountMessageId,
		threadId,
		mailboxIds,
		now,
		threadStillExists,
		threadUpdatedProperties,
	} = params;

	const emailModSeq = await bumpStateTx(tx, accountId, "Email");
	await tx.insert(changeLogTable).values({
		id: crypto.randomUUID(),
		accountId,
		type: "Email",
		objectId: accountMessageId,
		op: "destroy",
		modSeq: emailModSeq,
		updatedPropertiesJson: null,
		createdAt: now,
	});

	if (threadStillExists) {
		const threadModSeq = await bumpStateTx(tx, accountId, "Thread");
		await tx.insert(changeLogTable).values({
			id: crypto.randomUUID(),
			accountId,
			type: "Thread",
			objectId: threadId,
			op: "update",
			modSeq: threadModSeq,
			updatedPropertiesJson: serializeUpdatedProperties(
				threadUpdatedProperties ?? THREAD_EMAIL_ID_PROPS
			),
			createdAt: now,
		});
	}

	if (mailboxIds.length > 0) {
		const mailboxModSeq = await bumpStateTx(tx, accountId, "Mailbox");
		for (const mailboxId of mailboxIds) {
			await tx.insert(changeLogTable).values({
				id: crypto.randomUUID(),
				accountId,
				type: "Mailbox",
				objectId: mailboxId,
				op: "update",
				modSeq: mailboxModSeq,
				updatedPropertiesJson: serializeUpdatedProperties(MAILBOX_COUNT_PROPS),
				createdAt: now,
			});
		}
	}
}
