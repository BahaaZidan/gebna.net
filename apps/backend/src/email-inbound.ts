// import { v } from "@gebna/validation";
import { eq } from "drizzle-orm";
import * as PostalMime from "postal-mime";

import { getDB } from "./db";
import { messageTable, userTable } from "./db/schema";

export const email: NonNullable<
	ExportedHandler<CloudflareBindings, unknown, unknown>["email"]
> = async (message, bindings, _context) => {
	const parser = new PostalMime.default();
	const rawEmail = new Response(message.raw);
	const email = await parser.parse(await rawEmail.arrayBuffer());

	const rawFrom = email.headers.find((h) => h.key.toLowerCase() === "from")?.value.split(",");
	if (rawFrom?.length !== 1) return message.setReject("Message have more than one sender.");

	// const cf_auth_test_header_names = [
	// 	"dkim-signature",
	// 	"arc-authentication-results",
	// 	"arc-message-signature",
	// 	"arc-seal",
	// 	"authentication-results",
	// 	"received-spf",
	// 	"arc-authentication-results",
	// ];

	const { from, to, cc, bcc, deliveredTo, sender } = email;
	console.log("POSTAL MIME =>", { from, to, cc, bcc, deliveredTo, sender });
	console.log("MESSAGE =>", { from: message.from, to: message.to });
	// const authenticationResultss = headers.find((h) => h.key === "Authentication-Results");

	const db = getDB(bindings);
	const [recipientUser] = await db
		.select()
		.from(userTable)
		.where(eq(userTable.username, message.to.split("@")[0]));
	if (!recipientUser) return message.setReject("Invalid recipient.");

	await db.insert(messageTable).values({
		id: crypto.randomUUID(),
		receiver: recipientUser.id,
		sentTimestamp: email.date ? new Date(email.date) : new Date(),
		fromRaw: message.from,
		toRaw: email.to?.map((a) => a.address).join(","),
		ccRaw: email.cc?.map((a) => a.address).join(","),
		bccRaw: email.bcc?.map((a) => a.address).join(","),
		size: message.rawSize,
		subject: email.subject,
		messageIdHeader: email.messageId,
	});

	// console.log(email);
	// console.log(bindings);
};
