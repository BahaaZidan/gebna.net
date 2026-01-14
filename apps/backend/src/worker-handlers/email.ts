import { eq, sql } from "drizzle-orm";
import PostalMime from "postal-mime";
import { ulid } from "ulid";

import {
	ConversationInsertModel,
	ConversationParticipantInsertModel,
	ConversationSelectModel,
	getDB,
	IdentityInsertModel,
	MessageDeliveryInsertModel,
	MessageInsertModel,
} from "$lib/db";
import {
	conversationParticipantTable,
	conversationTable,
	conversationViewerStateTable,
	identityTable,
	messageDeliveryTable,
	messageTable,
} from "$lib/db/schema";
import { extractLocalPart } from "$lib/utils/email";
import { buildCidResolver } from "$lib/utils/email-attachments";
import { normalizeAndSanitizeEmailBody } from "$lib/utils/email-html-normalization";

const DEFAULT_PARTICIPANT_ROLE: ConversationParticipantInsertModel["role"] = "MEMBER";
const DEFAULT_PARTICIPANT_STATE: ConversationParticipantInsertModel["state"] = "ACTIVE";

function normalizeAddress(address: string) {
	return address.trim().toLowerCase();
}

function extractMessageIds(headerValue?: string | null): string[] {
	if (!headerValue) return [];
	const matches =
		headerValue
			.match(/<[^>]+>/g)
			?.map((m) => m.trim())
			.filter(Boolean) ?? [];
	if (matches.length) return matches;
	const fallback = headerValue.trim();
	return fallback ? [fallback] : [];
}

function identityKindFor(address: string): IdentityInsertModel["kind"] {
	return address.endsWith("@gebna.net") ? "GEBNA_USER" : "EXTERNAL_EMAIL";
}

async function ensureIdentity(db: ReturnType<typeof getDB>, address: string) {
	const normalized = normalizeAddress(address);
	const kind = identityKindFor(normalized);
	const existing = await db.query.identityTable.findFirst({
		where: (t, { eq, and }) => and(eq(t.kind, kind), eq(t.address, normalized)),
	});
	if (existing) return existing;
	const [created] = await db
		.insert(identityTable)
		.values({ id: ulid(), address: normalized, kind })
		.returning();
	return created;
}

function transportForIdentity(identity: { kind: IdentityInsertModel["kind"] }) {
	return identity.kind === "GEBNA_USER" ? "GEBNA_DM" : "EMAIL";
}

async function findConversationIdByEmailThreadMessageIds(
	db: ReturnType<typeof getDB>,
	threadMessageIds: string[]
): Promise<string | null> {
	if (!threadMessageIds.length) return null;

	const rows = await db.all<{ conversationId: string }>(
		sql`SELECT conversationId
				FROM message
				WHERE emailMetadata IS NOT NULL
					AND json_extract(emailMetadata, '$.messageId') IN (
						${sql.join(
							threadMessageIds.map((id) => sql`${id}`),
							sql`, `
						)}
					)
				ORDER BY createdAt DESC
				LIMIT 1`
	);

	return rows[0]?.conversationId;
}

export async function emailHandler(
	envelope: ForwardableEmailMessage,
	bindings: CloudflareBindings,
	_context: ExecutionContext
) {
	const db = getDB(bindings);

	const recipientLocal = extractLocalPart(envelope.to);
	const recipientUser = await db.query.userTable.findFirst({
		where: (t, { eq }) => eq(t.username, recipientLocal),
	});
	if (!recipientUser) return envelope.setReject("ADDRESS NOT FOUND!");

	const parsedEmail = await PostalMime.parse(envelope.raw);
	if (!parsedEmail.from?.address) return envelope.setReject("FROM NOT SET!");

	const cidResolver = buildCidResolver(parsedEmail.attachments);
	const normalizedBody = normalizeAndSanitizeEmailBody(parsedEmail, {
		cidResolver,
		blockRemoteImagesByDefault: false,
		allowDataImages: Boolean(cidResolver),
	});

	const fromAddress = normalizeAddress(parsedEmail.from.address);
	const senderIdentity = await ensureIdentity(db, fromAddress);

	const to = (parsedEmail.to ?? [])
		.map((a) => a.address)
		.filter(Boolean)
		.map(normalizeAddress);
	const cc = (parsedEmail.cc ?? [])
		.map((a) => a.address)
		.filter(Boolean)
		.map(normalizeAddress);
	const bcc = (parsedEmail.bcc ?? [])
		.map((a) => a.address)
		.filter(Boolean)
		.map(normalizeAddress);
	const replyTo = (parsedEmail.replyTo ?? [])
		.map((a) => a.address)
		.filter(Boolean)
		.map(normalizeAddress);

	const envelopeToAddress = normalizeAddress(envelope.to);

	const parsedMessageId = extractMessageIds(parsedEmail.messageId)[0] ?? null;
	let existingMessage: {
		id: string;
		conversationId: string;
	} | null = null;
	if (parsedMessageId) {
		const existing = await db.all<{ id: string; conversationId: string }>(
			sql`SELECT id, conversationId
					FROM message
					WHERE emailMetadata IS NOT NULL
						AND json_extract(emailMetadata, '$.messageId') = ${parsedMessageId}
					LIMIT 1`
		);
		existingMessage = existing[0] ?? null;
	}

	const participantAddresses = Array.from(
		new Set([fromAddress, ...to, ...cc, ...bcc, ...replyTo, envelopeToAddress])
	).filter(Boolean);

	// TODO: optimize
	const participantIdentities = await Promise.all(
		participantAddresses.map((address) => ensureIdentity(db, address))
	);

	const desiredConversationKind: ConversationInsertModel["kind"] =
		participantIdentities.length > 2 ? "GROUP" : "PRIVATE";
	const now = new Date();

	let conversation: ConversationSelectModel | null = null;

	if (existingMessage) {
		conversation =
			(await db.query.conversationTable.findFirst({
				where: (t, { eq }) => eq(t.id, existingMessage.conversationId),
			})) ?? null;
		if (conversation && conversation.kind === "PRIVATE" && desiredConversationKind === "GROUP") {
			conversation = null;
		}
	}

	const threadLookupMessageIds = Array.from(
		new Set([
			...extractMessageIds(parsedEmail.inReplyTo),
			...extractMessageIds(parsedEmail.references),
		])
	);

	if (!conversation) {
		const threadConversationId = await findConversationIdByEmailThreadMessageIds(
			db,
			threadLookupMessageIds
		);
		if (threadConversationId) {
			const existingThreadConversation =
				(await db.query.conversationTable.findFirst({
					where: (t, { eq }) => eq(t.id, threadConversationId),
				})) ?? null;
			if (
				existingThreadConversation &&
				!(existingThreadConversation.kind === "PRIVATE" && desiredConversationKind === "GROUP")
			) {
				conversation = existingThreadConversation;
			}
		}
	}

	if (!conversation && desiredConversationKind === "PRIVATE") {
		const ids = participantIdentities.map((i) => i.id).sort();
		const dmKey = `${ids[0]}:${ids[1]}`;
		conversation =
			(await db.query.conversationTable.findFirst({
				where: (t, { eq }) => eq(t.dmKey, dmKey),
			})) ||
			(
				await db
					.insert(conversationTable)
					.values({
						id: ulid(),
						kind: "PRIVATE",
						title: parsedEmail.subject,
						dmKey,
					})
					.returning()
			)[0];
	} else if (!conversation) {
		const [created] = await db
			.insert(conversationTable)
			.values({
				id: ulid(),
				kind: "GROUP",
				title: parsedEmail.subject,
			})
			.returning();
		conversation = created;
	}

	await db
		.insert(conversationParticipantTable)
		.values(
			participantIdentities.map((identity) => ({
				id: ulid(),
				conversationId: conversation.id,
				identityId: identity.id,
				role: DEFAULT_PARTICIPANT_ROLE,
				state: DEFAULT_PARTICIPANT_STATE,
				lastReadMessageId: null,
			}))
		)
		.onConflictDoNothing();

	const messageId = ulid();
	const emailMetadata = {
		to,
		cc,
		bcc,
		replyTo,
		inReplyTo: parsedEmail.inReplyTo,
		messageId: parsedEmail.messageId,
		references: parsedEmail.references,
	} satisfies MessageInsertModel["emailMetadata"];

	await db.transaction(async (tx) => {
		const persistedMessageId = existingMessage?.id ?? messageId;
		if (!existingMessage) {
			await tx.insert(messageTable).values({
				id: persistedMessageId,
				conversationId: conversation.id,
				senderIdentityId: senderIdentity.id,
				bodyText: normalizedBody?.plain,
				bodyHTML: normalizedBody?.html,
				emailMetadata,
			});
		}

		const deliveries = participantIdentities
			.filter((identity) => identity.id !== senderIdentity.id)
			.map(
				(identity) =>
					({
						id: `${persistedMessageId}:${identity.id}`,
						messageId: persistedMessageId,
						recipientIdentityId: identity.id,
						status: "DELIVERED",
						transport: transportForIdentity(identity),
					}) satisfies MessageDeliveryInsertModel
			);

		if (deliveries.length) {
			await tx.insert(messageDeliveryTable).values(deliveries).onConflictDoNothing();
		}

		if (!existingMessage) {
			await tx
				.update(conversationTable)
				.set({ updatedAt: now, lastMessageAt: now })
				.where(eq(conversationTable.id, conversation.id));
		}

		const viewerStateUnread = deliveries.some((delivery) => {
			const localAddress = participantAddresses.find(
				(addr) => addr === `${recipientUser.username}@gebna.net`
			);
			return (
				localAddress &&
				delivery.recipientIdentityId ===
					participantIdentities.find((i) => i.address === localAddress)?.id
			);
		})
			? 1
			: 0;

		await tx
			.insert(conversationViewerStateTable)
			.values({
				id: ulid(),
				ownerId: recipientUser.id,
				conversationId: conversation.id,
				mailbox: "IMPORTANT",
				unreadCount: viewerStateUnread,
			})
			.onConflictDoUpdate({
				target: [conversationViewerStateTable.ownerId, conversationViewerStateTable.conversationId],
				set: {
					unreadCount: viewerStateUnread,
					updatedAt: now,
				},
			});
	});
}
