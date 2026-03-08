import { getTableConfig, relations } from "@gebna/db";
import { rehypeEnforcePalette } from "@gebna/utils";
import { ALLOWED_ATTACHMENT_MIME_TYPES } from "@gebna/vali";
import SchemaBuilder from "@pothos/core";
import DrizzlePlugin from "@pothos/plugin-drizzle";
import RelayPlugin from "@pothos/plugin-relay";
import ScopeAuthPlugin from "@pothos/plugin-scope-auth";
import WithInputPlugin from "@pothos/plugin-with-input";
import { DateTimeResolver } from "graphql-scalars";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { find } from "unist-util-find";
import { visit } from "unist-util-visit";

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
	plugins: [RelayPlugin, ScopeAuthPlugin, WithInputPlugin, DrizzlePlugin],
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
const EmailAttachmentFileCategoryEnum = builder.enumType("EmailAttachmentFileCategory", {
	values: EmailAttachmentFileCategoryEnumValues,
});

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
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.template": "Word",
	"application/vnd.ms-word.document.macroenabled.12": "Word",
	"application/vnd.ms-word.template.macroenabled.12": "Word",
	"application/vnd.ms-excel": "Excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.template": "Excel",
	"application/vnd.ms-excel.sheet.macroenabled.12": "Excel",
	"application/vnd.ms-excel.template.macroenabled.12": "Excel",
	"application/vnd.ms-excel.addin.macroenabled.12": "Excel",
	"application/vnd.ms-excel.sheet.binary.macroenabled.12": "Excel",
	"application/vnd.ms-powerpoint": "Other",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": "Slides",
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
			resolve: (ref) => ref.givenName || ref.address_?.name || ref.address_?.address!,
		}),
		avatar: t.string({
			nullable: false,
			resolve: (ref) =>
				ref.givenAvatar || ref.address_?.inferredAvatar || ref.address_?.avatarPlaceholder!,
		}),
		isSelf: t.boolean({
			nullable: false,
			resolve: (ref, args, ctx) => ctx.viewer.email === ref.address_?.address,
		}),
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
									inlineAttachments.map((attachment) => [attachment.contentId, attachment])
								);

								visit(
									tree,
									"element",
									(node: { tagName?: string; properties?: Record<string, unknown> }) => {
										if (node.tagName !== "img") return;

										const properties = node.properties;
										const src = properties?.src ? String(properties.src) : null;
										if (!src?.toLowerCase().startsWith("cid:")) return;

										const contentId = src.slice(4).trim();
										const attachment = inlineAttachmentByContentId.get(contentId);
										if (!attachment) return;

										const mimeType = attachment.mimeType?.trim() || "application/octet-stream";
										properties!.src = `data:${mimeType};base64,${attachment.content.toString("base64")}`;
									}
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
									// TODO: investigate supporting outlook, yahoo, and others?
									if (!classNames.includes("gmail_quote")) return false;
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
			resolve: ({ bodyPlaintext, bodyHTML }) => (bodyHTML ? null : bodyPlaintext),
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
				where: {
					lastMessageId: {
						isNotNull: true,
					},
				},
			}),
		}),
	}),
});

builder.queryType({
	fields: (t) => ({
		viewer: t.drizzleField({
			type: ViewerRef,
			resolve(query, parent, args, ctx, info) {
				return ctx.db.query.users.findFirst(query({ where: { id: ctx.viewer.id } }));
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

function isElementNodeWithProperties(node: unknown): node is ElementNodeWithProperties {
	return (
		typeof node === "object" &&
		node !== null &&
		"type" in node &&
		node.type === "element" &&
		"tagName" in node &&
		typeof node.tagName === "string"
	);
}
