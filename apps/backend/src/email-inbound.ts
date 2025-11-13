// import { v } from "@gebna/validation";
import { eq } from "drizzle-orm";
import * as PostalMime from "postal-mime";

import { getDB } from "./db";
import { blobTable, messageTable, userTable } from "./db/schema";
import { getR2KeyFromHash, sha256Hex, storeAttachmentsForMessage } from "./email";

export const email: NonNullable<
	ExportedHandler<CloudflareBindings, unknown, unknown>["email"]
> = async (message, bindings, _context) => {
	console.log("MESSAGE =>", { from: message.from, to: message.to });

	const parser = new PostalMime.default();
	const rawEmail = new Response(message.raw);
	const rawEmailBuffer = await rawEmail.arrayBuffer();
	const email = await parser.parse(rawEmailBuffer);

	console.log("MESSAGE_ID =>", email.messageId);

	const rawFrom = email.headers.find((h) => h.key.toLowerCase() === "from")?.value.split(",");
	if (rawFrom?.length !== 1) return message.setReject("Message have more than one sender.");

	const db = getDB(bindings);
	const [recipientUser] = await db
		.select()
		.from(userTable)
		.where(eq(userTable.username, message.to.split("@")[0]));
	if (!recipientUser) return message.setReject("Invalid recipient.");

	const rawSha256 = await sha256Hex(rawEmailBuffer);

	await bindings.R2_EMAILS.put(getR2KeyFromHash(rawSha256), rawEmailBuffer, {
		httpMetadata: { contentType: "message/rfc822" },
	}).catch(() => {
		/* TODO */
	});

	await db
		.insert(blobTable)
		.values({ sha256: rawSha256, size: message.rawSize })
		.onConflictDoNothing();

	const [newMessage] = await db
		.insert(messageTable)
		.values({
			id: crypto.randomUUID(),
			receiver: recipientUser.id,
			rawSha256,
			sentTimestamp: email.date ? new Date(email.date) : new Date(),
			fromRaw: message.from,
			toRaw: email.to?.map((a) => a.address).join(","),
			ccRaw: email.cc?.map((a) => a.address).join(","),
			bccRaw: email.bcc?.map((a) => a.address).join(","),
			size: message.rawSize,
			subject: email.subject,
			messageIdHeader: email.messageId,
			attachmentsPreview: (email.attachments ?? []).map((a) => ({
				filename: a.filename,
				mimeType: a.mimeType,
			})),
		})
		.onConflictDoNothing({
			target: [messageTable.receiver, messageTable.rawSha256],
		})
		.returning();

	await storeAttachmentsForMessage({
		attachments: email.attachments,
		messageId: newMessage.id,
		db,
		attachmentsBucket: bindings.R2_EMAILS,
	});
};

// const cf_auth_test_header_names = [
// 	"dkim-signature",
// 	"arc-authentication-results",
// 	"arc-message-signature",
// 	"arc-seal",
// 	"authentication-results",
// 	"received-spf",
// 	"arc-authentication-results",
// ];
