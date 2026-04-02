import { createGraphQLError } from "graphql-yoga";
import { convert } from "html-to-text";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { find } from "unist-util-find";
import { visit } from "unist-util-visit";
import * as v from "valibot";

import { rehypeEnforcePalette } from "#/lib/email";
import type { PostalSendEmailBody } from "#/lib/email/types";

import { builder } from "../builder";
import { EmailThreadRef } from "./thread";

export const EmailMessageRef = builder.drizzleNode("emailMessages", {
	name: "EmailMessage",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: {
			ownerId: true,
		},
	},
	authScopes: (m) => ({ ownedByViewer: m.ownerId }),
	fields: (t) => ({
		from: t.relation("fromRef", { nullable: false }),
		to: t.relation("toRef", { nullable: false }),
		createdAt: t.expose("createdAt", {
			type: "DateTime",
			nullable: false,
		}),
		snippet: t.string({
			select: {
				columns: {
					bodyPlaintext: true,
				},
			},
			resolve: ({ bodyPlaintext }) => {
				return bodyPlaintext?.slice(0, 100);
			},
		}),
		html: t.string({
			select: {
				columns: {
					bodyHTML: true,
				},
				with: {
					inlineAttachments: true,
				},
			},
			resolve: async ({ bodyHTML, inlineAttachments }) => {
				if (!bodyHTML) return null;
				const html = (
					await unified()
						.use(rehypeParse)
						// WORKAROUND: this should be owned by the clients(?). we do it here for now.
						.use(rehypeEnforcePalette, {
							palette: {
								// daisyUI black theme tokens converted to email-safe hex
								bg: "#000000", // --color-base-100
								text: "#d6d6d6", // --color-base-content
								link: "#d6d6d6", // --color-base-content
								muted: "#1b1b1b", // --color-base-300
								fontFamily:
									"Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
							},
							injectBaseCss: true,
							force: true, // flip to true if you want to override explicit colors too
						})
						.use(() => {
							return (tree) => {
								const inlineAttachmentByContentId = new Map(
									inlineAttachments.map((attachment) => [
										attachment.contentId,
										attachment,
									]),
								);

								visit(
									tree,
									"element",
									(node: {
										tagName?: string;
										properties?: Record<string, unknown>;
									}) => {
										if (node.tagName !== "img") return;

										const properties = node.properties;
										const src = properties?.src ? String(properties.src) : null;
										if (!src?.toLowerCase().startsWith("cid:")) return;

										const contentId = src.slice(4).trim();
										const attachment =
											inlineAttachmentByContentId.get(contentId);
										if (!attachment) return;

										const mimeType =
											attachment.mimeType?.trim() || "application/octet-stream";
										properties!.src = `data:${mimeType};base64,${attachment.content.toString("base64")}`;
									},
								);
							};
						})
						.use(() => {
							return (tree) => {
								const node = find(tree, (node) => {
									if (!isElementNodeWithProperties(node)) return false;
									if (node.tagName !== "div") return false;
									const classNames = node.properties?.className;
									if (!Array.isArray(classNames)) return false;
									// TODO: investigate supporting outlook and other grains of sand :(
									if (
										!classNames.includes("gmail_quote") &&
										!classNames.includes("yahoo_quoted") &&
										!classNames.includes("moz-cite-prefix")
									)
										return false;
									return true;
								});
								if (!isElementNodeWithProperties(node)) return;

								const quotedNode = {
									type: "element" as const,
									tagName: node.tagName,
									properties: node.properties,
									children: Array.isArray(node.children) ? node.children : [],
								};

								node.tagName = "details";
								node.properties = {};
								node.children = [
									{
										type: "element",
										tagName: "summary",
										properties: {},
										children: [{ type: "text", value: "Show quoted content" }],
									},
									quotedNode,
								];
							};
						})
						.use(rehypeStringify)
						.process(bodyHTML)
				).toString();
				return html;
			},
		}),
		plaintext: t.string({
			select: {
				columns: {
					bodyPlaintext: true,
					bodyHTML: true,
				},
			},
			resolve: ({ bodyPlaintext, bodyHTML }) =>
				bodyHTML ? null : bodyPlaintext,
		}),
		attachments: t.relation("attachments", { nullable: false }),
	}),
});

type ElementNodeWithProperties = {
	type: "element";
	tagName: string;
	properties?: Record<string, unknown>;
	children?: unknown[];
};

function isElementNodeWithProperties(
	node: unknown,
): node is ElementNodeWithProperties {
	return (
		typeof node === "object" &&
		node !== null &&
		"type" in node &&
		node.type === "element" &&
		"tagName" in node &&
		typeof node.tagName === "string"
	);
}

const EmailMessageRecipientsInput = builder.inputType(
	"EmailMessageRecipients",
	{
		fields: (t) => ({
			to: t.stringList({
				validate: v.array(v.pipe(v.string(), v.trim(), v.email())),
			}),
			cc: t.stringList({
				validate: v.array(v.pipe(v.string(), v.trim(), v.email())),
			}),
			bcc: t.stringList({
				validate: v.array(v.pipe(v.string(), v.trim(), v.email())),
			}),
		}),
	},
);

builder.relayMutationField(
	"sendEmailMessage",
	{
		inputFields: (t) => ({
			bodyInMarkdown: t.string({
				validate: v.pipe(v.string(), v.trim()),
			}),
			recipients: t.field({
				required: true,
				type: EmailMessageRecipientsInput,
			}),
			subject: t.string({
				required: true,
				validate: v.pipe(v.string(), v.trim(), v.nonEmpty()),
			}),
		}),
	},
	{
		resolve: async (_root, { input }, ctx) => {
			let from = ctx.viewer.email;
			let apiUrl = new URL("api/v1/send/message", ctx.env.OUTBOUND_API_URL);

			try {
				const html_body =
					input.bodyInMarkdown &&
					(
						await unified()
							.use(remarkParse)
							.use(remarkGfm)
							.use(remarkRehype, { allowDangerousHtml: true })
							.use(rehypeStringify, { allowDangerousHtml: true })
							.process(input.bodyInMarkdown)
					).toString();
				const plain_body = html_body && convert(html_body);

				await fetch(apiUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Server-API-Key": ctx.env.OUTBOUND_API_SECRET,
					},
					body: JSON.stringify({
						headers: {
							"X-App": "gebna.net",
						},
						from,
						reply_to: from,
						to: input.recipients.to,
						cc: input.recipients.cc,
						bcc: input.recipients.bcc,
						subject: input.subject,
						html_body,
						plain_body,
					} satisfies PostalSendEmailBody),
				});
			} catch (error) {
				console.error(error);
				throw createGraphQLError("Something went wrong!", {
					extensions: {
						http: { status: 500 },
					},
				});
			}
		},
	},
	{
		outputFields: (t) => ({
			result: t.field({
				type: "Boolean",
				resolve: async (result, _root, ctx) => {
					return true;
				},
			}),
		}),
	},
);
