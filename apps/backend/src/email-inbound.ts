import * as PostalMime from "postal-mime";

export const email: NonNullable<
	ExportedHandler<CloudflareBindings, unknown, unknown>["email"]
> = async (message, bindings, context) => {
	const parser = new PostalMime.default();
	const rawEmail = new Response(message.raw);
	const email = await parser.parse(await rawEmail.arrayBuffer());

	console.log(email);
	console.log(bindings);
};
