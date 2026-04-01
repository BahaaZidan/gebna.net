import { ALLOWED_ATTACHMENT_MIME_TYPES } from "#/lib/email";

import { builder } from "../builder";

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

export const EmailAttachmentRef = builder.drizzleNode("emailAttachments", {
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
