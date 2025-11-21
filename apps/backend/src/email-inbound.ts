import { and, eq, inArray } from "drizzle-orm";
import type { Address as ParsedAddress, Email as ParsedEmail } from "postal-mime";

import { getDB, type TransactionInstance } from "./db";
import {
	accountMessageTable,
	accountTable,
	identityTable,
	mailboxMessageTable,
	mailboxTable,
	vacationResponseLogTable,
	vacationResponseTable,
} from "./db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "./lib/jmap/constants";
import {
	buildBodyStructure,
	ensureAccountBlob,
	ensureBlobInR2,
	makeSnippet,
	normalizeEmail,
	parseRawEmail,
	parseSentAt,
	resolveOrCreateThreadId,
	storeAddresses,
	storeAttachments,
	storeHeaders,
	upsertBlob,
	upsertCanonicalMessage,
} from "./lib/mail/ingest";
import { recordEmailCreateChanges } from "./lib/jmap/change-log";
import { createOutboundTransport } from "./lib/outbound";
import { sha256HexFromArrayBuffer } from "./lib/utils";

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

const MAX_RAW_BYTES = JMAP_CONSTRAINTS[JMAP_CORE].maxSizeUpload;
const VACATION_REPEAT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getPrimarySenderAddress(email: ParsedEmail): string | null {
	let candidate: ParsedAddress | null | undefined = null;
	if (email.from) {
		candidate = Array.isArray(email.from) ? (email.from[0] ?? null) : (email.from as ParsedAddress);
	} else if (email.sender) {
		candidate = Array.isArray(email.sender)
			? (email.sender[0] ?? null)
			: (email.sender as ParsedAddress);
	}
	if (!candidate) return null;
	const addr = (candidate as ParsedAddress).address ?? null;
	return normalizeEmail(addr);
}

function hasAutoSubmittedHeader(email: ParsedEmail): boolean {
	const headers = email.headers ?? [];
	return headers.some((entry) => {
		if (!entry || !entry.key) return false;
		if (entry.key.toLowerCase() !== "auto-submitted") return false;
		const value = (entry.value ?? "no").toLowerCase();
		return value !== "no";
	});
}

async function getInboxMailboxId(
	tx: TransactionInstance,
	accountId: string
): Promise<string | null> {
	const [byRole] = await tx
		.select({ id: mailboxTable.id })
		.from(mailboxTable)
		.where(and(eq(mailboxTable.accountId, accountId), eq(mailboxTable.role, "inbox")))
		.limit(1);

	if (byRole) return byRole.id;

	const [byName] = await tx
		.select({ id: mailboxTable.id })
		.from(mailboxTable)
		.where(and(eq(mailboxTable.accountId, accountId), eq(mailboxTable.name, "Inbox")))
		.limit(1);

	return byName?.id ?? null;
}

function encodeDisplayName(name: string): string {
	if (!name) return "";
	if (/^[A-Za-z0-9 .'-]+$/.test(name)) {
		return name;
	}
	return `"${name.replace(/"/g, '\\"')}"`;
}

function buildVacationMime(options: {
	fromName: string | null;
	fromEmail: string;
	toEmail: string;
	subject: string;
	textBody: string | null;
	htmlBody: string | null;
}): string {
	const { fromName, fromEmail, toEmail, subject, textBody, htmlBody } = options;
	const fromHeader = fromName ? `${encodeDisplayName(fromName)} <${fromEmail}>` : fromEmail;
	const chosenHtml = htmlBody ?? null;
	const chosenText = textBody ?? (chosenHtml ? null : "I am currently away from my inbox.");
	if (chosenHtml && chosenText) {
		const boundary = crypto.randomUUID();
		return [
			`From: ${fromHeader}`,
			`To: ${toEmail}`,
			`Subject: ${subject}`,
			"Auto-Submitted: auto-replied",
			"MIME-Version: 1.0",
			`Content-Type: multipart/alternative; boundary="${boundary}"`,
			"",
			`--${boundary}`,
			"Content-Type: text/plain; charset=UTF-8",
			"Content-Transfer-Encoding: 8bit",
			"",
			chosenText,
			`--${boundary}`,
			"Content-Type: text/html; charset=UTF-8",
			"Content-Transfer-Encoding: 8bit",
			"",
			chosenHtml,
			`--${boundary}--`,
		].join("\r\n");
	}
	const body = chosenHtml ?? chosenText ?? "I am currently away from my inbox.";
	const contentType = chosenHtml ? "text/html" : "text/plain";
	return [
		`From: ${fromHeader}`,
		`To: ${toEmail}`,
		`Subject: ${subject}`,
		"Auto-Submitted: auto-replied",
		`Content-Type: ${contentType}; charset=UTF-8`,
		"",
		body,
	].join("\r\n");
}

async function maybeSendVacationAutoReply(options: {
	db: ReturnType<typeof getDB>;
	env: CloudflareBindings;
	accountId: string;
	accountAddress: string;
	senderAddress: string;
	originalSubject: string | null;
	accountMessageId: string;
}): Promise<void> {
	const { db, env, accountId, accountAddress, senderAddress, originalSubject, accountMessageId } =
		options;
	const [vacation] = await db
		.select({
			isEnabled: vacationResponseTable.isEnabled,
			fromDate: vacationResponseTable.fromDate,
			toDate: vacationResponseTable.toDate,
			subject: vacationResponseTable.subject,
			textBody: vacationResponseTable.textBody,
			htmlBody: vacationResponseTable.htmlBody,
		})
		.from(vacationResponseTable)
		.where(eq(vacationResponseTable.accountId, accountId))
		.limit(1);

	if (!vacation || !vacation.isEnabled) return;

	const now = new Date();
	if (vacation.fromDate && now < vacation.fromDate) return;
	if (vacation.toDate && now > vacation.toDate) return;

	const [recent] = await db
		.select({ respondedAt: vacationResponseLogTable.respondedAt })
		.from(vacationResponseLogTable)
		.where(
			and(
				eq(vacationResponseLogTable.accountId, accountId),
				eq(vacationResponseLogTable.contact, senderAddress)
			)
		)
		.limit(1);

	if (recent) {
		const last = new Date(recent.respondedAt);
		if (now.getTime() - last.getTime() < VACATION_REPEAT_INTERVAL_MS) {
			return;
		}
	}

	const [identity] = await db
		.select({ name: identityTable.name, email: identityTable.email })
		.from(identityTable)
		.where(and(eq(identityTable.accountId, accountId), eq(identityTable.isDefault, true)))
		.limit(1);

	const fromEmail = identity?.email ?? accountAddress;
	const fromName = identity?.name ?? null;
	const subjectBase = originalSubject ? `Re: ${originalSubject}` : "Out of office";
	const subject = vacation.subject ?? subjectBase;
	const textBody = vacation.textBody ?? null;
	const htmlBody = vacation.htmlBody ?? null;
	const mime = buildVacationMime({
		fromName,
		fromEmail,
		toEmail: senderAddress,
		subject,
		textBody,
		htmlBody,
	});

	const transport = createOutboundTransport(env);
	const result = await transport.send({
		accountId,
		submissionId: crypto.randomUUID(),
		emailId: accountMessageId,
		envelope: {
			mailFrom: fromEmail,
			rcptTo: [senderAddress],
		},
		mime: {
			kind: "inline",
			raw: mime,
		},
	});

	if (result.status !== "accepted") {
		return;
	}

	await db
		.insert(vacationResponseLogTable)
		.values({ accountId, contact: senderAddress, respondedAt: now })
		.onConflictDoUpdate({
			target: [vacationResponseLogTable.accountId, vacationResponseLogTable.contact],
			set: { respondedAt: now },
		});
}

// ───────────────────────────────────────────────────────────
// Cloudflare Email Worker entrypoint
// ───────────────────────────────────────────────────────────

export async function email(
	message: ForwardableEmailMessage,
	env: CloudflareBindings,
	_ctx: ExecutionContext
) {
	const db = getDB(env);

	try {
		const now = new Date();

		const rawBuffer = await new Response(message.raw).arrayBuffer();
		if (rawBuffer.byteLength > MAX_RAW_BYTES) {
			console.warn("Inbound email too large, dropping", {
				size: rawBuffer.byteLength,
				to: message.to,
			});
			return;
		}

		const rawSha = await sha256HexFromArrayBuffer(rawBuffer);

		const parsed = await parseRawEmail(rawBuffer);
		const email = parsed.email;
		const snippet = makeSnippet(email);
		const sentAt = parseSentAt(email);
		const size = rawBuffer.byteLength;
		const { structure: bodyStructure, attachments } = await buildBodyStructure(parsed, size);
		const bodyStructureJson = JSON.stringify(bodyStructure);
		const hasAttachment = attachments.length > 0;

		const ingestId = rawSha;

		await ensureBlobInR2(env, rawSha, rawBuffer);

		const senderAddress = getPrimarySenderAddress(email);
		const autoSubmitted = hasAutoSubmittedHeader(email);
		const deliveries: {
			accountId: string;
			accountMessageId: string;
			accountAddress: string;
		}[] = [];

		await db.transaction(async (tx) => {
			// 1) Blob for raw MIME
			await upsertBlob(tx, rawSha, size, now);

			// 2) Canonical message
			const canonicalMessageId = await upsertCanonicalMessage({
				tx,
				ingestId,
				rawBlobSha256: rawSha,
				email,
				snippet,
				sentAt,
				size,
				hasAttachment,
				bodyStructureJson,
				now,
			});

			// 3) Headers
			await storeHeaders({ tx, canonicalMessageId, email });

			// 4) Attachments
			const attachmentBlobShas = await storeAttachments({
				tx,
				env,
				canonicalMessageId,
				attachments,
				now,
			});

			// 5) Addresses
			await storeAddresses({ tx, canonicalMessageId, email });

			const recipientAddresses = collectRecipientAddresses(message, email);
			if (recipientAddresses.length === 0) {
				console.warn("Inbound email with no resolvable recipients");
				return;
			}

			const accountRows = await tx
				.select({ id: accountTable.id, address: accountTable.address })
				.from(accountTable)
				.where(inArray(accountTable.address, recipientAddresses));

			if (!accountRows.length) {
				console.warn("No local account for recipients", recipientAddresses);
				return;
			}

			const targets = new Map<string, { accountId: string; address: string }>();
			for (const row of accountRows) {
				if (!row.address) continue;
				if (!targets.has(row.id)) {
					targets.set(row.id, { accountId: row.id, address: row.address });
				}
			}

			for (const target of targets.values()) {
				const accountId = target.accountId;
				const internalDate = now;

				await ensureAccountBlob(tx, accountId, rawSha, now);
				for (const sha of attachmentBlobShas) {
					await ensureAccountBlob(tx, accountId, sha, now);
				}

				const threadId = await resolveOrCreateThreadId({
					tx,
					accountId,
					subject: email.subject ?? null,
					internalDate,
					inReplyTo: email.inReplyTo ?? null,
					referencesHeader: email.references ?? null,
				});

				const insertResult = await tx
					.insert(accountMessageTable)
					.values({
						id: crypto.randomUUID(),
						accountId,
						messageId: canonicalMessageId,
						threadId,
						internalDate,
						isSeen: false,
						isFlagged: false,
						isAnswered: false,
						isDraft: false,
						isDeleted: false,
						createdAt: now,
						updatedAt: now,
					})
					.onConflictDoNothing({
						target: [accountMessageTable.accountId, accountMessageTable.messageId],
					})
					.returning({ id: accountMessageTable.id });

				let accountMessageId = insertResult[0]?.id as string | undefined;

				if (!accountMessageId) {
					const [existing] = await tx
						.select({ id: accountMessageTable.id })
						.from(accountMessageTable)
						.where(
							and(
								eq(accountMessageTable.accountId, accountId),
								eq(accountMessageTable.messageId, canonicalMessageId)
							)
						)
						.limit(1);

					if (!existing) {
						throw new Error("Failed to upsert accountMessage");
					}
					accountMessageId = existing.id;
				}

				const mailboxIds: string[] = [];
				const inboxId = await getInboxMailboxId(tx, accountId);
				if (!inboxId) {
					console.warn("No Inbox mailbox for account", accountId);
				} else {
					mailboxIds.push(inboxId);
					await tx
						.insert(mailboxMessageTable)
						.values({
							accountMessageId,
							mailboxId: inboxId,
							addedAt: now,
						})
						.onConflictDoNothing();
				}

				await recordEmailCreateChanges({
					tx,
					accountId,
					accountMessageId,
					threadId,
					mailboxIds,
					now,
				});

				deliveries.push({
					accountId,
					accountMessageId,
					accountAddress: target.address,
				});
			}
		});

		if (senderAddress && !autoSubmitted) {
			for (const delivery of deliveries) {
				if (senderAddress === delivery.accountAddress) continue;
				await maybeSendVacationAutoReply({
					db,
					env,
					accountId: delivery.accountId,
					accountAddress: delivery.accountAddress,
					senderAddress,
					originalSubject: email.subject ?? null,
					accountMessageId: delivery.accountMessageId,
				});
			}
		}

		console.log("Inbound email stored with ingestId", ingestId);
	} catch (err) {
		console.error("Error handling inbound email", err);
	}
}
function collectRecipientAddresses(
	message: ForwardableEmailMessage,
	email: ParsedEmail
): string[] {
	const recipients = new Set<string>();

	const pushAddress = (value: string | null | undefined) => {
		const normalized = normalizeEmail(value);
		if (normalized) {
			recipients.add(normalized);
		}
	};

	const collectFromParsed = (value: ParsedEmail["to"]) => {
		if (!value) return;
		if (Array.isArray(value)) {
			for (const entry of value) {
				if (!entry) continue;
				if (typeof entry === "string") {
					pushAddress(entry);
				} else if (Array.isArray(entry)) {
					for (const nested of entry) {
						if (typeof nested === "string") {
							pushAddress(nested);
						} else if (nested && typeof nested === "object") {
							pushAddress((nested as ParsedAddress).address ?? null);
						}
					}
				} else if (typeof entry === "object") {
					pushAddress((entry as ParsedAddress).address ?? null);
				}
			}
		} else if (typeof value === "string") {
			pushAddress(value);
		} else if (typeof value === "object") {
			pushAddress((value as ParsedAddress).address ?? null);
		}
	};

	pushAddress(message.to);
	collectFromParsed(email.to);
	collectFromParsed(email.cc);
	collectFromParsed(email.bcc);

	return Array.from(recipients);
}
