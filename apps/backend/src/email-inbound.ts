// import { v } from "@gebna/validation";
// import { inArray } from "drizzle-orm";
import * as PostalMime from "postal-mime";

// import { getDB } from "./db";

// import { userTable } from "./db/schema";

export const email: NonNullable<
	ExportedHandler<CloudflareBindings, unknown, unknown>["email"]
> = async (message, bindings, _context) => {
	const parser = new PostalMime.default();
	const rawEmail = new Response(message.raw);
	const email = await parser.parse(await rawEmail.arrayBuffer());

	const rawFrom = email.headers.find((h) => h.key.toLowerCase() === "from")?.value.split(",");
	if (rawFrom?.length !== 1) return message.setReject("Message have more than one sender.");

	// const deliveredTo = email.deliveredTo?.trim().toLowerCase();
	// const allRecipients = [...(email.to ?? []), ...(email.cc ?? []), ...(email.bcc ?? [])];
	// if (!deliveredTo && allRecipients.length === 0)
	// 	return message.setReject("No valid recipient headers found.");

	const cf_auth_test_header_names = [
		"dkim-signature",
		"arc-authentication-results",
		"arc-message-signature",
		"arc-seal",
		"authentication-results",
		"received-spf",
		"arc-authentication-results",
	];

	const { from, to, cc, bcc, deliveredTo, sender } = email;
	console.log("POSTAL MIME =>", { from, to, cc, bcc, deliveredTo, sender });
	console.log("MESSAGE =>", { from: message.from, to: message.to });
	// const authenticationResultss = headers.find((h) => h.key === "Authentication-Results");

	// const db = getDB(bindings);
	// const doesEmailExist = await db.select().from(userTable).where(inArray(userTable.username, processedHeadersValidation.output.))

	// console.log(email);
	// console.log(bindings);
};
