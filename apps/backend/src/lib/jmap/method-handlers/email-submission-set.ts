import { and, eq, inArray } from "drizzle-orm";
import { Context } from "hono";

import { getDB } from "../../../db";
import {
	accountMessageTable,
	addressTable,
	emailSubmissionTable,
	identityTable,
	messageAddressTable,
	messageTable,
} from "../../../db/schema";
import {
	processSingleSubmission,
	QUEUE_STATUS_CANCELED,
	QUEUE_STATUS_PENDING,
} from "../../outbound/submission-queue";
import { DeliveryStatusRecord } from "../../types";
import { JMAPHonoAppEnv } from "../middlewares";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "../constants";
import { JmapMethodResponse } from "../types";
import { ensureAccountAccess, getAccountState, getAccountMailboxes, isRecord } from "../utils";
import { recordCreate, recordUpdate } from "../change-log";
import { applyEmailSet } from "./email-set";

export async function handleEmailSubmissionSet(
	c: Context<JMAPHonoAppEnv>,
	args: Record<string, unknown>,
	tag: string
): Promise<JmapMethodResponse | JmapMethodResponse[]> {
	const db = getDB(c.env);

	const accountIdArg = args.accountId as string | undefined;
	const effectiveAccountId = ensureAccountAccess(c, accountIdArg);
	if (!effectiveAccountId) {
		return ["error", { type: "accountNotFound" }, tag];
	}

	const state = await getAccountState(db, effectiveAccountId, "EmailSubmission");
	const ifInState = args.ifInState as string | undefined;
	if (ifInState && ifInState !== state) {
		return ["error", { type: "stateMismatch" }, tag];
	}

	const maxSetObjects = JMAP_CONSTRAINTS[JMAP_CORE].maxObjectsInSet ?? 128;
	const createCount = isRecord(args.create) ? Object.keys(args.create).length : 0;
	const updateCount = isRecord(args.update) ? Object.keys(args.update).length : 0;
	const destroyCount = Array.isArray(args.destroy) ? args.destroy.length : 0;
	if (createCount > maxSetObjects) {
		return ["error", { type: "limitExceeded", description: `create exceeds maxObjectsInSet (${maxSetObjects})` }, tag];
	}
	if (updateCount > maxSetObjects) {
		return ["error", { type: "limitExceeded", description: `update exceeds maxObjectsInSet (${maxSetObjects})` }, tag];
	}
	if (destroyCount > maxSetObjects) {
		return ["error", { type: "limitExceeded", description: `destroy exceeds maxObjectsInSet (${maxSetObjects})` }, tag];
	}

	const createMap = (args.create as Record<string, unknown> | undefined) ?? {};
	const mailboxInfo =
		Object.keys(createMap).length > 0 ? await getAccountMailboxes(db, effectiveAccountId) : null;
	const onSuccessUpdateEmailResult = parseOnSuccessUpdateEmail(args.onSuccessUpdateEmail);
	if ("error" in onSuccessUpdateEmailResult) {
		return [
			"error",
			{ type: "invalidArguments", description: onSuccessUpdateEmailResult.error },
			tag,
		];
	}
	let onSuccessUpdateEmail = onSuccessUpdateEmailResult.value;
	if (mailboxInfo) {
		onSuccessUpdateEmail = addDefaultSubmissionEmailPatches({
			existing: onSuccessUpdateEmail,
			createMap,
			mailboxInfo,
		});
	}

	const onSuccessDestroyArg =
		args.onSuccessDestroyEmail !== undefined ? args.onSuccessDestroyEmail : args.onSuccessDestroyOriginal;
	const onSuccessDestroyEmailResult = parseOnSuccessDestroyEmail(onSuccessDestroyArg);
	if ("error" in onSuccessDestroyEmailResult) {
		return [
			"error",
			{ type: "invalidArguments", description: onSuccessDestroyEmailResult.error },
			tag,
		];
	}
	const onSuccessDestroyEmail = onSuccessDestroyEmailResult.value;

	const input: EmailSubmissionSetArgs = {
		accountId: effectiveAccountId,
		create: createMap,
		update: (args.update as Record<string, unknown> | undefined) ?? undefined,
		destroy: (args.destroy as string[] | undefined) ?? undefined,
	};

	try {
		const result = await applyEmailSubmissionSet(c.env, db, input);

		const responses: JmapMethodResponse[] = [
			[
				"EmailSubmission/set",
				{
					accountId: result.accountId,
					oldState: result.oldState ?? state,
					newState: result.newState ?? state,
					created: result.created,
					notCreated: result.notCreated,
					updated: result.updated,
					notUpdated: result.notUpdated,
					destroyed: result.destroyed,
					notDestroyed: result.notDestroyed,
				},
				tag,
			],
		];

		const implicitEmailOps = buildImplicitEmailSubmissionOps({
			createMap,
			creationMeta: result.creationMeta,
			onSuccessDestroyEmail,
			onSuccessUpdateEmail,
		});

		if ("error" in implicitEmailOps) {
			return ["error", { type: "invalidArguments", description: implicitEmailOps.error }, tag];
		}

		if (implicitEmailOps.operations) {
			const emailSetArgs = {
				accountId: effectiveAccountId,
				update:
					Object.keys(implicitEmailOps.operations.update).length > 0
						? implicitEmailOps.operations.update
						: undefined,
				destroy:
					implicitEmailOps.operations.destroy.length > 0
						? implicitEmailOps.operations.destroy
						: undefined,
			};

			if (emailSetArgs.update || emailSetArgs.destroy) {
				const emailSetResult = await applyEmailSet(c.env, db, emailSetArgs);
				responses.push([
					"Email/set",
					{
						accountId: emailSetResult.accountId,
						oldState: emailSetResult.oldState,
						newState: emailSetResult.newState,
						created: emailSetResult.created,
						notCreated: emailSetResult.notCreated,
						updated: emailSetResult.updated,
						notUpdated: emailSetResult.notUpdated,
						destroyed: emailSetResult.destroyed,
						notDestroyed: emailSetResult.notDestroyed,
					},
					tag,
				]);
			}
		}

		return responses.length === 1 ? responses[0]! : responses;
	} catch (err) {
		console.error("EmailSubmission/set error", err);
		return ["error", { type: "serverError" }, tag];
	}
}

async function applyEmailSubmissionSet(
	env: JMAPHonoAppEnv["Bindings"],
	db: ReturnType<typeof getDB>,
	args: EmailSubmissionSetArgs
): Promise<EmailSubmissionSetResult> {
	const accountId = args.accountId;
	const createMap = args.create ?? {};
	const updateMap = args.update ?? {};
	const destroyList = args.destroy ?? [];

	const created: Record<string, unknown> = {};
	const notCreated: Record<string, EmailSubmissionFailure> = {};
	const updated: Record<string, unknown> = {};
	const notUpdated: Record<string, EmailSubmissionFailure> = {};
	const destroyed: string[] = [];
	const notDestroyed: Record<string, EmailSubmissionFailure> = {};
	const creationMeta: Record<string, { emailId: string }> = {};

	const createEntries = Object.entries(createMap);
	const updateEntries = Object.entries(updateMap);
	const oldStateValue = await getAccountState(db, accountId, "EmailSubmission");

	if (createEntries.length === 0 && updateEntries.length === 0 && destroyList.length === 0) {
		return {
			accountId,
			oldState: oldStateValue,
			newState: oldStateValue,
			created,
			notCreated,
			updated,
			notUpdated,
			destroyed,
			notDestroyed,
			creationMeta,
		};
	}

	const now = new Date();
	const undoWindowMs = getUndoWindowDurationMs(env);
	const submissionsToProcess: string[] = [];

	for (const [createId, raw] of createEntries) {
		let parsed: EmailSubmissionCreate;
		try {
			parsed = parseEmailSubmissionCreate(raw);
		} catch (err) {
			if (err instanceof EmailSubmissionProblem) {
				notCreated[createId] = { type: err.jmapType, description: err.message };
				continue;
			}
			throw err;
		}
		const [identity] = await db
			.select({
				id: identityTable.id,
				email: identityTable.email,
			})
			.from(identityTable)
			.where(and(eq(identityTable.id, parsed.identityId), eq(identityTable.accountId, accountId)))
			.limit(1);

		if (!identity) {
			notCreated[createId] = {
				type: "invalidProperties",
				description: "identityId does not belong to this account",
			};
			continue;
		}

		const [accountMessage] = await db
			.select({
				id: accountMessageTable.id,
				messageId: accountMessageTable.messageId,
				threadId: accountMessageTable.threadId,
			})
			.from(accountMessageTable)
			.where(
				and(
					eq(accountMessageTable.id, parsed.emailId),
					eq(accountMessageTable.accountId, accountId),
					eq(accountMessageTable.isDeleted, false)
				)
			)
			.limit(1);

		if (!accountMessage) {
			notCreated[createId] = {
				type: "notFound",
				description: "emailId not found",
			};
			continue;
		}

		const [messageRow] = await db
			.select({
				id: messageTable.id,
				rawBlobSha256: messageTable.rawBlobSha256,
				size: messageTable.size,
			})
			.from(messageTable)
			.where(eq(messageTable.id, accountMessage.messageId))
			.limit(1);

		if (!messageRow) {
			notCreated[createId] = {
				type: "serverError",
				description: "Canonical message missing",
			};
			continue;
		}

		let envelope: ResolvedEnvelope;
		try {
			envelope = await resolveEnvelopeForSubmission({
				db,
				messageId: messageRow.id,
				identityEmail: identity.email,
				override: parsed.envelope,
			});
		} catch (err) {
			notCreated[createId] = {
				type: err instanceof EmailSubmissionProblem ? err.jmapType : "invalidProperties",
				description: err instanceof Error ? err.message : "Failed to resolve envelope",
			};
			continue;
		}

		const submissionId = crypto.randomUUID();
		const releaseAt = computeReleaseTime({
			now,
			requestedSendAt: parsed.sendAt,
			undoWindowMs,
		});
		const shouldProcessNow = releaseAt.getTime() <= now.getTime();
		const undoStatusValue = shouldProcessNow ? "final" : "pending";

		const deliveryStatus: DeliveryStatusRecord = {
			status: "pending",
			lastAttempt: 0,
			retryCount: 0,
		};

		await db.insert(emailSubmissionTable).values({
			id: submissionId,
			accountId,
			emailId: parsed.emailId,
			identityId: parsed.identityId,
			envelopeJson: JSON.stringify(envelope),
			sendAt: releaseAt,
			status: QUEUE_STATUS_PENDING,
			nextAttemptAt: releaseAt,
			retryCount: 0,
			deliveryStatusJson: deliveryStatus,
			undoStatus: undoStatusValue,
			createdAt: now,
			updatedAt: now,
		});

		await recordCreate(db, {
			accountId,
			type: "EmailSubmission",
			objectId: submissionId,
			now,
		});

		if (shouldProcessNow) {
			submissionsToProcess.push(submissionId);
		}

		created[createId] = {
			id: submissionId,
			emailId: parsed.emailId,
			identityId: parsed.identityId,
			sendAt: releaseAt.toISOString(),
			undoStatus: undoStatusValue,
		};
		creationMeta[createId] = { emailId: parsed.emailId };
	}

	for (const [updateId, rawPatch] of updateEntries) {
		let patch: EmailSubmissionUpdate;
		try {
			patch = parseEmailSubmissionUpdate(rawPatch);
		} catch (err) {
			if (err instanceof EmailSubmissionProblem) {
				notUpdated[updateId] = { type: err.jmapType, description: err.message };
				continue;
			}
			throw err;
		}

		if (!patch.undoStatus) {
			continue;
		}

		const [row] = await db
			.select({
				id: emailSubmissionTable.id,
				status: emailSubmissionTable.status,
				undoStatus: emailSubmissionTable.undoStatus,
			})
			.from(emailSubmissionTable)
			.where(and(eq(emailSubmissionTable.id, updateId), eq(emailSubmissionTable.accountId, accountId)))
			.limit(1);

		if (!row) {
			notUpdated[updateId] = { type: "notFound", description: "EmailSubmission not found" };
			continue;
		}

		if (row.status !== QUEUE_STATUS_PENDING || row.undoStatus !== "pending") {
			notUpdated[updateId] = {
				type: "cannotUnsend",
				description: "Submission can no longer be canceled",
			};
			continue;
		}

		const updateTime = new Date();
		await db
			.update(emailSubmissionTable)
			.set({
				status: QUEUE_STATUS_CANCELED,
				undoStatus: "canceled",
				nextAttemptAt: null,
				updatedAt: updateTime,
			})
			.where(and(eq(emailSubmissionTable.id, updateId), eq(emailSubmissionTable.accountId, accountId)));

		await recordUpdate(db, {
			accountId,
			type: "EmailSubmission",
			objectId: row.id,
			now: updateTime,
		});
		updated[updateId] = { id: row.id };
	}

	for (const destroyId of destroyList) {
		notDestroyed[destroyId] = {
			type: "invalidArguments",
			description: "EmailSubmission destroy is not supported",
		};
	}

	for (const submissionId of submissionsToProcess) {
		try {
			await processSingleSubmission(env, submissionId);
		} catch (err) {
			console.error("EmailSubmission queue processing error", submissionId, err);
		}
	}

	const mutated =
		Object.keys(created).length > 0 || Object.keys(updated).length > 0 || destroyed.length > 0;
	const newStateValue = mutated ? await getAccountState(db, accountId, "EmailSubmission") : oldStateValue;

	return {
		accountId,
		oldState: oldStateValue,
		newState: newStateValue,
		created,
		notCreated,
		updated,
		notUpdated,
		destroyed,
		notDestroyed,
		creationMeta,
	};
}

async function resolveEnvelopeForSubmission(options: {
	db: ReturnType<typeof getDB>;
	messageId: string;
	identityEmail: string;
	override?: EmailSubmissionEnvelopeOverride;
}): Promise<ResolvedEnvelope> {
	const { db, messageId, identityEmail, override } = options;

	const identityAddress = normalizeEnvelopeAddress(identityEmail);
	if (!identityAddress) {
		throw new EmailSubmissionProblem(
			"invalidProperties",
			"Identity email address is invalid"
		);
	}

	const mailFrom = getMailFromAddress(identityAddress, override?.mailFrom?.email);

	if (override?.rcptTo !== undefined && override.rcptTo.length > 0) {
		const rcptTo = override.rcptTo.map((r) => r.email);
		return { mailFrom, rcptTo };
	}

	const rows = await db
		.select({ email: addressTable.email })
		.from(messageAddressTable)
		.innerJoin(addressTable, eq(messageAddressTable.addressId, addressTable.id))
		.where(
			and(
				eq(messageAddressTable.messageId, messageId),
				inArray(messageAddressTable.kind, ["to", "cc", "bcc"])
			)
		)
		.orderBy(messageAddressTable.kind, messageAddressTable.position);

	const seen = new Set<string>();
	const rcptTo: string[] = [];

	for (const row of rows) {
		const email = row.email;
		if (!seen.has(email)) {
			seen.add(email);
			rcptTo.push(email);
		}
	}

	if (rcptTo.length === 0) {
		throw new EmailSubmissionProblem(
			"invalidProperties",
			"EmailSubmission/create has no recipients; rcptTo is empty"
		);
	}

	return { mailFrom, rcptTo };
}

type NormalizedEnvelopeAddress = {
	value: string;
	lowerValue: string;
	lowerDomain: string;
};

function normalizeEnvelopeAddress(value: string): NormalizedEnvelopeAddress | null {
	const trimmed = value.trim();
	const atIndex = trimmed.lastIndexOf("@");
	if (atIndex <= 0 || atIndex === trimmed.length - 1) {
		return null;
	}
	const localPart = trimmed.slice(0, atIndex);
	const domainPart = trimmed.slice(atIndex + 1);
	if (!domainPart) {
		return null;
	}
	const lowerDomain = domainPart.toLowerCase();
	return {
		value: `${localPart}@${domainPart}`,
		lowerValue: `${localPart.toLowerCase()}@${lowerDomain}`,
		lowerDomain,
	};
}

function getMailFromAddress(
	identityAddress: NormalizedEnvelopeAddress,
	overrideEmail: string | undefined
): string {
	if (!overrideEmail) {
		return identityAddress.value;
	}
	const trimmed = overrideEmail.trim();
	if (!trimmed) {
		return identityAddress.value;
	}
	const normalizedOverride = normalizeEnvelopeAddress(trimmed);
	if (!normalizedOverride) {
		throw new EmailSubmissionProblem(
			"invalidProperties",
			"EmailSubmission/create.envelope.mailFrom.email must be a valid email address when provided"
		);
	}
	const matchesIdentity =
		normalizedOverride.lowerValue === identityAddress.lowerValue ||
		normalizedOverride.lowerDomain === identityAddress.lowerDomain;
	if (!matchesIdentity) {
		throw new EmailSubmissionProblem(
			"invalidProperties",
			"Envelope mailFrom overrides must use the selected identity's address or domain"
		);
	}
	return normalizedOverride.value;
}

function parseEmailSubmissionCreate(raw: unknown): EmailSubmissionCreate {
	if (!isRecord(raw)) {
		throw new EmailSubmissionProblem(
			"invalidProperties",
			"EmailSubmission/create must be an object"
		);
	}

	const emailIdValue = raw.emailId;
	if (typeof emailIdValue !== "string" || emailIdValue.length === 0) {
		throw new EmailSubmissionProblem(
			"invalidProperties",
			"EmailSubmission/create.emailId must be a non-empty string"
		);
	}

	const identityIdValue = raw.identityId;
	if (typeof identityIdValue !== "string" || identityIdValue.length === 0) {
		throw new EmailSubmissionProblem(
			"invalidProperties",
			"EmailSubmission/create.identityId must be a non-empty string"
		);
	}

	const result: EmailSubmissionCreate = {
		emailId: emailIdValue,
		identityId: identityIdValue,
	};

	const envelopeValue = raw.envelope;
	if (envelopeValue !== undefined) {
		if (!isRecord(envelopeValue)) {
			throw new EmailSubmissionProblem(
				"invalidProperties",
				"EmailSubmission/create.envelope must be an object when present"
			);
		}

		const envelope: EmailSubmissionEnvelopeOverride = {};

		const mailFromValue = envelopeValue.mailFrom;
		if (mailFromValue !== undefined) {
			if (!isRecord(mailFromValue) || typeof mailFromValue.email !== "string") {
				throw new EmailSubmissionProblem(
					"invalidProperties",
					"EmailSubmission/create.envelope.mailFrom.email must be a string when present"
				);
			}
			envelope.mailFrom = { email: mailFromValue.email };
		}

		const rcptToValue = envelopeValue.rcptTo;
		if (rcptToValue !== undefined) {
			if (!Array.isArray(rcptToValue)) {
				throw new EmailSubmissionProblem(
					"invalidProperties",
					"EmailSubmission/create.envelope.rcptTo must be an array when present"
				);
			}
			const rcptTo: { email: string }[] = [];
			for (const item of rcptToValue) {
				if (!isRecord(item) || typeof item.email !== "string") {
					throw new EmailSubmissionProblem(
						"invalidProperties",
						"EmailSubmission/create.envelope.rcptTo items must have an email string property"
					);
				}
				rcptTo.push({ email: item.email });
			}
			envelope.rcptTo = rcptTo;
		}

		result.envelope = envelope;
	}

	const sendAtValue = raw.sendAt;
	if (sendAtValue !== undefined) {
		if (typeof sendAtValue !== "string") {
			throw new EmailSubmissionProblem(
				"invalidProperties",
				"EmailSubmission/create.sendAt must be a string when provided"
			);
		}
		const parsedDate = new Date(sendAtValue);
		if (Number.isNaN(parsedDate.getTime())) {
			throw new EmailSubmissionProblem(
				"invalidProperties",
				"EmailSubmission/create.sendAt must be a valid RFC 3339 timestamp"
			);
		}
		result.sendAt = parsedDate;
	}

	return result;
}

function parseEmailSubmissionUpdate(raw: unknown): EmailSubmissionUpdate {
	if (!isRecord(raw)) {
		throw new EmailSubmissionProblem(
			"invalidProperties",
			"EmailSubmission/update patch must be an object"
		);
	}

	const patch: EmailSubmissionUpdate = {};
	if (raw.undoStatus !== undefined) {
		if (raw.undoStatus !== "canceled") {
			throw new EmailSubmissionProblem(
				"invalidProperties",
				"EmailSubmission/update.undoStatus may only be set to \"canceled\""
			);
		}
		patch.undoStatus = "canceled";
	}

	return patch;
}

type EmailSubmissionCreate = {
	emailId: string;
	identityId: string;
	envelope?: EmailSubmissionEnvelopeOverride;
	sendAt?: Date;
};

type EmailSubmissionUpdate = {
	undoStatus?: "canceled";
};

type ResolvedEnvelope = {
	mailFrom: string;
	rcptTo: string[];
};

type EmailSubmissionSetArgs = {
	accountId: string;
	create?: Record<string, unknown>;
	update?: Record<string, unknown>;
	destroy?: string[];
};

type EmailSubmissionSetResult = {
	accountId: string;
	oldState?: string;
	newState?: string;
	created: Record<string, unknown>;
	notCreated: Record<string, EmailSubmissionFailure>;
	updated: Record<string, unknown>;
	notUpdated: Record<string, EmailSubmissionFailure>;
	destroyed: string[];
	notDestroyed: Record<string, EmailSubmissionFailure>;
	creationMeta: Record<string, { emailId: string }>;
};

type EmailSubmissionEnvelopeOverride = {
	mailFrom?: { email: string };
	rcptTo?: { email: string }[];
};

type EmailSubmissionFailure = {
	type: string;
	description?: string;
};

class EmailSubmissionProblem extends Error {
	readonly jmapType: string;

	constructor(type: string, message: string) {
		super(message);
		this.jmapType = type;
	}
}

type OnSuccessUpdateMap = Record<string, Record<string, unknown>>;
type ParseResult<T> = { value: T } | { error: string };

function parseOnSuccessUpdateEmail(value: unknown): ParseResult<OnSuccessUpdateMap> {
	if (value === undefined || value === null) {
		return { value: {} };
	}

	if (!isRecord(value)) {
		return { error: "onSuccessUpdateEmail must be an object when provided" };
	}

	const parsed: OnSuccessUpdateMap = {};
	for (const [key, raw] of Object.entries(value)) {
		if (!isRecord(raw)) {
			return { error: `onSuccessUpdateEmail entry for ${key} must be an object` };
		}
		parsed[key] = raw;
	}
	return { value: parsed };
}

function parseOnSuccessDestroyEmail(value: unknown): ParseResult<string[]> {
	if (value === undefined || value === null) {
		return { value: [] };
	}

	if (!Array.isArray(value)) {
		return { error: "onSuccessDestroyEmail must be an array when provided" };
	}

	const items: string[] = [];
	for (const entry of value) {
		if (typeof entry !== "string" || entry.length === 0) {
			return { error: "onSuccessDestroyEmail entries must be non-empty strings" };
		}
		items.push(entry);
	}
	return { value: items };
}

type ImplicitEmailOpsResult =
	| { error: string }
	| { operations?: { destroy: string[]; update: Record<string, Record<string, unknown>> } };

function buildImplicitEmailSubmissionOps(opts: {
	createMap: Record<string, unknown>;
	creationMeta: Record<string, { emailId: string }>;
	onSuccessDestroyEmail: string[];
	onSuccessUpdateEmail: OnSuccessUpdateMap;
}): ImplicitEmailOpsResult {
	const requestedCreations = new Set(Object.keys(opts.createMap ?? {}));
	const resolveReference = (
		ref: string
	): { emailId: string } | { error: string } | null => {
		if (!ref.startsWith("#")) {
			return { emailId: ref };
		}
		const creationId = ref.slice(1);
		if (!requestedCreations.has(creationId)) {
			return { error: `Unknown onSuccess reference ${ref}` };
		}
		const meta = opts.creationMeta[creationId];
		if (!meta) {
			return null;
		}
		return { emailId: meta.emailId };
	};

	const destroyTargets = new Set<string>();
	for (const ref of opts.onSuccessDestroyEmail) {
		const resolved = resolveReference(ref);
		if (!resolved) continue;
		if ("error" in resolved) {
			return { error: resolved.error };
		}
		destroyTargets.add(resolved.emailId);
	}

	const updateMap: Record<string, Record<string, unknown>> = {};
	for (const [ref, patch] of Object.entries(opts.onSuccessUpdateEmail)) {
		const resolved = resolveReference(ref);
		if (!resolved) continue;
		if ("error" in resolved) {
			return { error: resolved.error };
		}
		updateMap[resolved.emailId] = patch;
	}

	if (destroyTargets.size === 0 && Object.keys(updateMap).length === 0) {
		return {};
	}

	return {
		operations: {
			destroy: Array.from(destroyTargets),
			update: updateMap,
		},
	};
}

function getUndoWindowDurationMs(env: CloudflareBindings): number {
	const raw = env.MAIL_UNDO_WINDOW_SECONDS;
	if (!raw) return 0;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) return 0;
	return parsed * 1000;
}

function computeReleaseTime(opts: {
	now: Date;
	requestedSendAt?: Date;
	undoWindowMs: number;
}): Date {
	const nowMs = opts.now.getTime();
	if (opts.requestedSendAt) {
		const desiredMs = opts.requestedSendAt.getTime();
		return new Date(desiredMs > nowMs ? desiredMs : nowMs);
	}
	if (opts.undoWindowMs > 0) {
		return new Date(nowMs + opts.undoWindowMs);
	}
	return new Date(nowMs);
}

type AccountMailboxInfo = Awaited<ReturnType<typeof getAccountMailboxes>>;

function addDefaultSubmissionEmailPatches(opts: {
	existing: OnSuccessUpdateMap;
	createMap: Record<string, unknown>;
	mailboxInfo: AccountMailboxInfo;
}): OnSuccessUpdateMap {
	if (Object.keys(opts.createMap ?? {}).length === 0) {
		return opts.existing;
	}
	const merged: OnSuccessUpdateMap = { ...opts.existing };
	const sentMailboxId = opts.mailboxInfo.byRole.get("sent")?.id ?? null;
	const draftsMailboxId = opts.mailboxInfo.byRole.get("drafts")?.id ?? null;

	for (const creationId of Object.keys(opts.createMap)) {
		const ref = `#${creationId}`;
		if (merged[ref]) continue;
		const patch = buildDefaultEmailSubmissionPatch(sentMailboxId, draftsMailboxId);
		if (!patch) continue;
		merged[ref] = patch;
	}
	return merged;
}

function buildDefaultEmailSubmissionPatch(
	sentMailboxId: string | null,
	draftsMailboxId: string | null
): Record<string, unknown> | null {
	const patch: Record<string, unknown> = {};
	const mailboxPatch: Record<string, boolean> = {};
	if (draftsMailboxId) {
		mailboxPatch[draftsMailboxId] = false;
	}
	if (sentMailboxId) {
		mailboxPatch[sentMailboxId] = true;
	}
	if (Object.keys(mailboxPatch).length > 0) {
		patch.mailboxIds = mailboxPatch;
	}

	const keywordPatch: Record<string, boolean> = {
		$draft: false,
		"\\draft": false,
	};
	patch.keywords = keywordPatch;

	return Object.keys(patch).length > 0 ? patch : null;
}
