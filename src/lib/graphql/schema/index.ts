import SchemaBuilder from "@pothos/core";
import DrizzlePlugin from "@pothos/plugin-drizzle";
import RelayPlugin from "@pothos/plugin-relay";
import ScopeAuthPlugin from "@pothos/plugin-scope-auth";
import ValidationPlugin from "@pothos/plugin-validation";
import WithInputPlugin from "@pothos/plugin-with-input";
import { and, eq } from "drizzle-orm";
import { DateTimeResolver } from "graphql-scalars";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { find } from "unist-util-find";
import { visit } from "unist-util-visit";
import * as v from "valibot";

import { dbSchema, getTableConfig, relations } from "#/lib/db";
import {
	ALLOWED_ATTACHMENT_MIME_TYPES,
	rehypeEnforcePalette,
} from "#/lib/email";

import type { GraphQLResolverContext } from "../types.js";

const builder = new SchemaBuilder<{
	DrizzleRelations: typeof relations;
	Context: GraphQLResolverContext;
	Scalars: {
		DateTime: {
			Input: Date;
			Output: Date;
		};
	};
	AuthScopes: {
		ownedByViewer: string;
	};
}>({
	plugins: [
		RelayPlugin,
		ScopeAuthPlugin,
		WithInputPlugin,
		DrizzlePlugin,
		ValidationPlugin,
	],
	drizzle: {
		client: (ctx) => ctx.db,
		getTableConfig,
		relations,
	},
	scopeAuth: {
		authScopes: async (context) => {
			return {
				ownedByViewer: (userId) => userId === context.viewer.id,
			};
		},
	},
});

builder.addScalarType("DateTime", DateTimeResolver);

const EmailAttachmentFileCategoryEnumValues = [
	"Image",
	"PDF",
	"Audio",
	"Video",
	"Word",
	"Excel",
	"Slides",
	"Calendar",
	"Archive",
	"Other",
] as const;
const EmailAttachmentFileCategoryEnum = builder.enumType(
	"EmailAttachmentFileCategory",
	{
		values: EmailAttachmentFileCategoryEnumValues,
	},
);

const EMAIL_ATTACHMENT_CATEGORY_BY_MIME_TYPE: Record<
	(typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
	(typeof EmailAttachmentFileCategoryEnumValues)[number]
> = {
	"image/jpeg": "Image",
	"image/png": "Image",
	"image/gif": "Image",
	"image/webp": "Image",
	"image/avif": "Image",
	"image/heic": "Image",
	"image/heif": "Image",
	"audio/mpeg": "Audio",
	"audio/mp4": "Audio",
	"audio/ogg": "Audio",
	"audio/wav": "Audio",
	"audio/x-wav": "Audio",
	"audio/webm": "Audio",
	"audio/aac": "Audio",
	"audio/flac": "Audio",
	"video/mp4": "Video",
	"video/webm": "Video",
	"video/ogg": "Video",
	"video/quicktime": "Video",
	"application/pdf": "PDF",
	"text/plain": "Other",
	"text/markdown": "Other",
	"application/msword": "Word",
	"application/vnd.ms-word": "Word",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		"Word",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.template":
		"Word",
	"application/vnd.ms-word.document.macroenabled.12": "Word",
	"application/vnd.ms-word.template.macroenabled.12": "Word",
	"application/vnd.ms-excel": "Excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.template":
		"Excel",
	"application/vnd.ms-excel.sheet.macroenabled.12": "Excel",
	"application/vnd.ms-excel.template.macroenabled.12": "Excel",
	"application/vnd.ms-excel.addin.macroenabled.12": "Excel",
	"application/vnd.ms-excel.sheet.binary.macroenabled.12": "Excel",
	"application/vnd.ms-powerpoint": "Other",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation":
		"Slides",
	"application/vnd.oasis.opendocument.text": "Word",
	"application/vnd.oasis.opendocument.spreadsheet": "Excel",
	"application/vnd.oasis.opendocument.presentation": "Slides",
	"text/csv": "Excel",
	"application/csv": "Excel",
	"text/calendar": "Calendar",
	"application/ics": "Calendar",
	"application/icalendar": "Calendar",
	"application/x-ical": "Calendar",
	"application/x-vcalendar": "Calendar",
	"application/zip": "Archive",
	"application/gzip": "Archive",
	"application/x-tar": "Archive",
	"application/x-7z-compressed": "Archive",
	"application/vnd.rar": "Archive",
	"application/x-rar-compressed": "Archive",
	"application/json": "Other",
	"application/xml": "Other",
	"text/xml": "Other",
};

const EmailAttachmentRef = builder.drizzleNode("emailAttachments", {
	name: "EmailAttachment",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: {
			ownerId: true,
		},
	},
	authScopes: (a) => ({ ownedByViewer: a.ownerId }),
	fields: (t) => ({
		description: t.exposeString("description"),
		filename: t.exposeString("filename"),
		sizeInBytes: t.exposeInt("sizeInBytes"),
		category: t.field({
			type: EmailAttachmentFileCategoryEnum,
			nullable: false,
			select: {
				columns: {
					mimeType: true,
				},
			},
			resolve: ({ mimeType }) => {
				if (!mimeType) return "Other" as const;

				const mappedCategory =
					EMAIL_ATTACHMENT_CATEGORY_BY_MIME_TYPE[
						mimeType as keyof typeof EMAIL_ATTACHMENT_CATEGORY_BY_MIME_TYPE
					];
				if (mappedCategory) return mappedCategory;

				return "Other" as const;
			},
		}),
		url: t.string({
			select: {
				columns: {
					content: true,
					mimeType: true,
				},
			},
			resolve: async ({ content, mimeType = "application/octet-stream" }) => {
				if (!content) return null;
				return `data:${mimeType};base64,${content.toString("base64")}`;
			},
		}),
	}),
});

const EmailAddressRefRef = builder.drizzleNode("emailAddressRefs", {
	name: "EmailAddressRef",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: {
			ownerId: true,
			givenName: true,
			givenAvatar: true,
		},
		with: { address_: true },
	},
	authScopes: (m) => ({ ownedByViewer: m.ownerId }),
	fields: (t) => ({
		address: t.exposeString("address", { nullable: false }),
		name: t.string({
			nullable: false,
			resolve: (ref) =>
				ref.givenName || ref.address_?.name || ref.address_?.address!,
		}),
		avatar: t.string({
			nullable: false,
			resolve: (ref) =>
				ref.givenAvatar ||
				ref.address_?.inferredAvatar ||
				ref.address_?.avatarPlaceholder!,
		}),
		isSelf: t.boolean({
			nullable: false,
			resolve: (ref, _args, ctx) => ctx.viewer.email === ref.address_?.address,
		}),
		isBlocked: t.exposeBoolean("isBlocked", { nullable: false }),
		isSpam: t.exposeBoolean("isSpam", { nullable: false }),
	}),
});

const EmailMessageRef = builder.drizzleNode("emailMessages", {
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

const EmailThreadRef = builder.drizzleNode("emailThreads", {
	name: "EmailThread",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: { ownerId: true },
	},
	authScopes: (c) => ({ ownedByViewer: c.ownerId }),
	fields: (t) => ({
		title: t.exposeString("title"),
		avatar: t.exposeString("uploadedAvatar"),
		participants: t.relation("participants", {
			nullable: false,
		}),
		lastMessage: t.relation("lastMessage", {
			nullable: false,
		}),
		messages: t.relatedConnection("messages", {
			nullable: false,
			edgesNullable: false,
			nodeNullable: false,
			query: () => ({
				orderBy: {
					createdAt: "asc",
				},
			}),
		}),
		unseenCount: t.exposeInt("unseenCount", { nullable: false }),
	}),
});

const ViewerRef = builder.drizzleObject("users", {
	name: "Viewer",
	select: {
		columns: {
			id: true,
			avatarPlaceholder: true,
			uploadedAvatar: true,
		},
	},
	fields: (t) => ({
		id: t.globalID({
			nullable: false,
			resolve: (parent) => {
				return { id: parent.id, type: "Viewer" };
			},
		}),
		name: t.exposeString("name", { nullable: false }),
		avatar: t.string({
			nullable: false,
			resolve: (user) => user.uploadedAvatar || user.avatarPlaceholder,
		}),
		emailAddress: t.exposeString("email", { nullable: false }),
		emailThreads: t.relatedConnection("emailThreads", {
			nullable: false,
			edgesNullable: false,
			nodeNullable: false,
			query: () => ({
				orderBy: {
					lastMessageAt: "desc",
				},
			}),
		}),
	}),
});

builder.queryType({
	fields: (t) => ({
		viewer: t.drizzleField({
			type: ViewerRef,
			resolve(query, _parent, _args, ctx) {
				return ctx.db.query.users.findFirst(
					query({ where: { id: ctx.viewer.id } }),
				);
			},
		}),
	}),
});

builder.relayMutationField(
	"updateEmailAddressRef",
	{
		inputFields: (t) => ({
			address: t.string({
				required: true,
				validate: v.pipe(v.string(), v.trim(), v.nonEmpty(), v.email()),
			}),
			givenName: t.string({
				validate: v.optional(
					v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(30)),
				),
			}),
			givenAvatar: t.string({
				validate: v.optional(
					v.pipe(v.string(), v.trim(), v.nonEmpty(), v.url()),
				),
			}),
			isBlocked: t.boolean(),
			isSpam: t.boolean(),
		}),
	},
	{
		resolve: async (_root, { input }, ctx) => {
			let table = dbSchema.emailAddressRefs;
			let [addressRef] = await ctx.db
				.update(table)
				.set({
					givenAvatar: input.givenAvatar,
					givenName: input.givenName,
					isBlocked: input.isBlocked!,
					isSpam: input.isSpam!,
				})
				.where(
					and(
						eq(table.address, input.address),
						eq(table.ownerId, ctx.viewer.id),
					),
				)
				.returning();
			return addressRef;
		},
	},
	{
		outputFields: (t) => ({
			result: t.field({
				type: EmailAddressRefRef,
				resolve: async (result, _root, ctx) => {
					if (!result) return;
					let address_ = (await ctx.db.query.emailAddresses.findFirst({
						where: { address: result.address },
					}))!;
					return { ...result, address_ };
				},
			}),
		}),
	},
);

builder.mutationType({
	fields: (t) => ({
		seeEmailThread: t.drizzleField({
			type: EmailThreadRef,
			args: {
				id: t.arg.globalID({ required: true }),
			},
			resolve: async (_query, _parent, args, ctx) => {
				return await ctx.db.transaction(async (tx) => {
					const [thread] = await tx
						.update(dbSchema.emailThreads)
						.set({ unseenCount: 0 })
						.where(
							and(
								eq(dbSchema.emailThreads.ownerId, ctx.viewer.id),
								eq(dbSchema.emailThreads.id, args.id.id),
							),
						)
						.returning();
					if (!thread) return;
					await tx
						.update(dbSchema.emailMessages)
						.set({ unseen: false })
						.where(eq(dbSchema.emailMessages.threadId, thread.id));
					return thread;
				});
			},
		}),
	}),
});

export const executableSchema = builder.toSchema();

export default executableSchema;

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
