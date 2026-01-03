import { AttachmentType } from "./graphql/resolvers.types";

export const MIME_TYPES_BY_ATTACHMENT_TYPE: Record<AttachmentType, string[]> = {
	Image: [
		"image/jpeg",
		"image/png",
		"image/gif",
		"image/webp",
		"image/heic",
		"image/heif",
		"image/svg+xml",
	],
	PDF: ["application/pdf"],
	CalendarInvite: ["text/calendar", "application/ics"],
	Document: [
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.oasis.opendocument.text",
		"application/rtf",
		"text/plain",
	],
	Spreadsheet: [
		"application/vnd.ms-excel",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"application/vnd.oasis.opendocument.spreadsheet",
		"text/csv",
	],
	Presentation: [
		"application/vnd.ms-powerpoint",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		"application/vnd.oasis.opendocument.presentation",
	],
	Media: [
		"audio/mpeg",
		"audio/mp4",
		"audio/wav",
		"audio/aac",
		"audio/ogg",
		"video/mp4",
		"video/quicktime",
		"video/x-msvideo",
		"video/x-matroska",
	],
	ZIP: [
		"application/zip",
		"application/x-7z-compressed",
		"application/x-rar-compressed",
		"application/x-tar",
		"application/gzip",
	],
	Other: [],
};

export const ATTACHMENT_TYPE_BY_MIME = (() => {
	const map = new Map<string, AttachmentType>();
	for (const type of Object.keys(MIME_TYPES_BY_ATTACHMENT_TYPE) as AttachmentType[]) {
		for (const mimeType of MIME_TYPES_BY_ATTACHMENT_TYPE[type]) {
			map.set(mimeType.toLowerCase(), type);
		}
	}
	return map;
})();
export const DEFAULT_ATTACHMENT_TYPE: AttachmentType = "Other";
