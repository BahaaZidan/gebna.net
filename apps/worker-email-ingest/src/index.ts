import { dbSchema, eq, getDB, increment } from "@gebna/db";
import { generateImagePlaceholder, R, stripAngleBrackets } from "@gebna/utils";
import { ALLOWED_ATTACHMENT_MIME_TYPES } from "@gebna/vali";
import { fileTypeFromBuffer } from "file-type";
import PostalMime from "postal-mime";

import { findOrCreateThread } from "./lib/find-or-create-thread";
import {
	inferAddressAvatar,
	type InferAddressAvatarQueueMessage,
} from "./lib/infer-address-avatar";
import { processEmailBody } from "./lib/process-email-body";
import {
	extractMessageIdsFromPostalMimeValue,
	getEmailMessageMetadata,
} from "./lib/process-email-headers";
import { workAroundFetch } from "./lib/workaround-fetch";

export default {
	fetch() {
		return new Response(`Running in ${navigator.userAgent}! LOLOooooooo`);
	},
	async email(envelope, env, ctx) {
		try {
			// TODO: maybe a good place to use never-throw ?
			const parsedEnvelope = await PostalMime.parse(envelope.raw, {
				rfc822Attachments: true,
				attachmentEncoding: "arraybuffer",
			});
			if (!parsedEnvelope.from || !parsedEnvelope.from.address)
				return envelope.setReject("INVALID");
			const db = getDB({
				url: env.TURSO_DATABASE_URL,
				authToken: env.TURSO_AUTH_TOKEN,
				fetch: workAroundFetch,
			});
			const recipientUser = await db.query.users.findFirst({
				where: {
					email: envelope.to,
				},
				with: {
					ownAddressRef: true,
					emailAddressRefs: {
						limit: 1,
						where: {
							address: envelope.from,
						},
						with: {
							address_: true,
						},
					},
				},
			});

			if (!recipientUser || !recipientUser.ownAddressRef) return envelope.setReject("NOT_FOUND");
			const participantsRefs = [recipientUser.ownAddressRef];
			let [fromAddressRef] = recipientUser.emailAddressRefs;
			if (fromAddressRef) {
				if (fromAddressRef.isSpam) return envelope.setReject("SPAM");
				if (fromAddressRef.isBlocked) return;
			} else {
				fromAddressRef = await db.transaction(async (tx) => {
					const [address_] = await tx
						.insert(dbSchema.emailAddresses)
						.values({
							address: envelope.from,
							name: parsedEnvelope.from!.name,
							avatarPlaceholder: generateImagePlaceholder(
								parsedEnvelope.from!.name || parsedEnvelope.from!.address!
							),
						})
						.returning()
						.onConflictDoNothing();

					const [addressRef] = await tx
						.insert(dbSchema.emailAddressRefs)
						.values({
							ownerId: recipientUser.id,
							address: envelope.from,
						})
						.returning();

					return { ...addressRef, address_ };
				});
				// TODO: enqueue address avatar inference here based on emailAddresses.updatedAt and createdAt
			}
			participantsRefs.push(fromAddressRef);

			const processedBody = await processEmailBody({ email: parsedEnvelope });
			const [canonicalMessageId] = extractMessageIdsFromPostalMimeValue(parsedEnvelope.messageId);
			const messageMetadata = getEmailMessageMetadata(parsedEnvelope);
			const participants = [
				...messageMetadata.to,
				...messageMetadata.cc,
				...messageMetadata.bcc,
				...messageMetadata.replyTo,
				{ address: envelope.to, name: "" },
				{ address: envelope.from, name: "" },
			];
			const uniqueParticipants = R.uniqBy((p) => p.address, participants);

			await db.transaction(async (tx) => {
				const ownerId = recipientUser.id;
				const thread = await findOrCreateThread({
					tx,
					ownerId,
					parsedEnvelope,
				});

				const [message] = await tx
					.insert(dbSchema.emailMessages)
					.values({
						ownerId,
						threadId: thread.id,
						sizeInBytes: envelope.rawSize,
						canonicalMessageId,
						bodyHTML: processedBody?.html,
						bodyPlaintext: processedBody?.plaintext,
						metadata: messageMetadata,
						from: envelope.from,
						to: envelope.to,
					})
					.returning();

				await tx
					.update(dbSchema.emailThreads)
					.set({
						unseenCount: increment(dbSchema.emailThreads.unseenCount),
						lastMessageAt: new Date(),
						lastMessageId: message.id,
					})
					.where(eq(dbSchema.emailThreads.id, thread.id));

				if (parsedEnvelope.attachments.length) {
					await tx.insert(dbSchema.emailAttachments).values(
						parsedEnvelope.attachments
							.filter(async (a) => {
								let fileTypeResult = await fileTypeFromBuffer(a.content as ArrayBuffer);
								if (!fileTypeResult) return false;
								if (fileTypeResult.mime !== a.mimeType) return false;
								if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(fileTypeResult.mime)) return false;
								return true;
							})
							.map((a) => {
								let content = Buffer.from(a.content as ArrayBuffer);
								return {
									ownerId,
									threadId: thread.id,
									messageId: message.id,
									fromRef: fromAddressRef.id,
									content,
									contentId: a.contentId && stripAngleBrackets(a.contentId),
									description: a.description,
									disposition: a.disposition,
									method: a.method,
									mimeType: a.mimeType,
									filename: a.filename,
									related: a.related,
									sizeInBytes: Buffer.byteLength(content),
								} satisfies typeof dbSchema.emailAttachments.$inferInsert;
							})
					);
				}

				const secondaryUniqueParticipants = uniqueParticipants.filter(
					(p) => ![envelope.from, envelope.to].includes(p.address)
				);
				if (secondaryUniqueParticipants.length) {
					await tx
						.insert(dbSchema.emailAddresses)
						.values(
							secondaryUniqueParticipants.map(
								(p) =>
									({
										address: p.address,
										name: p.name,
										avatarPlaceholder: generateImagePlaceholder(p.name || p.address),
									}) satisfies typeof dbSchema.emailAddresses.$inferInsert
							)
						)
						.onConflictDoNothing();
					const secondaryRefs = await tx
						.insert(dbSchema.emailAddressRefs)
						.values(
							secondaryUniqueParticipants.map(
								(p) =>
									({
										ownerId,
										address: p.address,
									}) satisfies typeof dbSchema.emailAddressRefs.$inferInsert
							)
						)
						.returning()
						.onConflictDoNothing();

					participantsRefs.push(...secondaryRefs);
				}

				await tx
					.insert(dbSchema.emailThreadParticipants)
					.values(
						participantsRefs.map(
							(ref) =>
								({
									threadId: thread.id,
									emailAddressRefId: ref.id,
								}) satisfies typeof dbSchema.emailThreadParticipants.$inferInsert
						)
					)
					.onConflictDoNothing();
			});

			await env.Q.sendBatch(
				uniqueParticipants.map((p) => ({
					body: {
						type: "infer-address-avatar",
						payload: {
							address: p.address,
						},
					} satisfies InferAddressAvatarQueueMessage,
					contentType: "json",
				}))
			);
		} catch (e) {
			console.error({ e });
		}
	},
	async queue(batch, env, ctx) {
		const db = getDB({
			url: env.TURSO_DATABASE_URL,
			authToken: env.TURSO_AUTH_TOKEN,
			fetch: workAroundFetch,
		});

		const tasks = batch.messages.map((message) =>
			(async () => {
				try {
					switch (message.body.type) {
						case "infer-address-avatar":
							return await inferAddressAvatar({ db, address: message.body.payload.address });
						default:
							return;
					}
				} catch (error) {
					console.error("queue processing failed", error);
					message.retry({ delaySeconds: 30 });
				}
			})()
		);

		const all = Promise.all(tasks);
		ctx.waitUntil(all);
		await all;
	},
} satisfies ExportedHandler<Env, InferAddressAvatarQueueMessage>;
