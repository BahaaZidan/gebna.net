export const ALLOWED_ATTACHMENT_MIME_TYPES = [
	// Images
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/avif",
	"image/heic",
	"image/heif",

	// Audio
	"audio/mpeg", // mp3
	"audio/mp4", // m4a / mp4 audio
	"audio/ogg",
	"audio/wav",
	"audio/x-wav",
	"audio/webm",
	"audio/aac",
	"audio/flac",

	// Video
	"video/mp4",
	"video/webm",
	"video/ogg",
	"video/quicktime", // mov

	// Documents
	"application/pdf",
	"text/plain",
	"text/markdown",
	"text/csv",
	"text/calendar",
	"application/ics",

	// Microsoft Office
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx

	// OpenDocument
	"application/vnd.oasis.opendocument.text", // odt
	"application/vnd.oasis.opendocument.spreadsheet", // ods
	"application/vnd.oasis.opendocument.presentation", // odp

	// Archives
	"application/zip",
	"application/gzip",
	"application/x-tar",
	"application/x-7z-compressed",
	"application/vnd.rar",

	// Misc common
	"application/json",
	"application/xml",
	"text/xml",
] as const;
