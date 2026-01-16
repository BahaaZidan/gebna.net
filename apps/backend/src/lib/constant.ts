const _ATTACHMENT_TYPES = [
	"Image",
	"PDF",
	"CalendarInvite",
	"Document",
	"Spreadsheet",
	"Presentation",
	"Media",
	"ZIP",
	"Other",
] as const;
type AttachmentType = (typeof _ATTACHMENT_TYPES)[number];

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

export const AVATAR_INFERENCE_DENYLIST = new Set([
	// Google (consumer)
	"gmail.com",
	"googlemail.com",

	// Microsoft consumer mail
	"outlook.com",
	"hotmail.com",
	"live.com",
	"msn.com",

	// Apple consumer mail
	"icloud.com",
	"me.com",
	"mac.com",

	// Yahoo
	"yahoo.com",
	"ymail.com",
	"rocketmail.com",

	// Proton
	"proton.me",
	"protonmail.com",
	"pm.me",

	// Tutanota
	"tutanota.com",
	"tutanota.de",
	"tutamail.com",
	"tuta.io",

	// Zoho Mail (consumer)
	"zohomail.com",

	// Fastmail
	"fastmail.com",
	"fastmail.fm",

	// HEY
	"hey.com",

	// AOL / Verizon legacy ISP mail
	"aol.com",
	"verizon.net",

	// GMX
	"gmx.com",
	"gmx.net",
	"gmx.de",
	"gmx.at",
	"gmx.ch",

	// Mail.com umbrella
	"mail.com",
	"email.com",

	// Yandex
	"yandex.com",
	"yandex.ru",
	"yandex.by",
	"yandex.kz",
	"yandex.ua",

	// Outlook regional
	"outlook.co.uk",
	"outlook.fr",
	"outlook.de",
	"outlook.it",
	"outlook.es",
	"outlook.jp",
	"outlook.in",

	// Hotmail regional
	"hotmail.co.uk",
	"hotmail.fr",
	"hotmail.de",

	// Yahoo regional
	"yahoo.co.uk",
	"yahoo.fr",
	"yahoo.de",
	"yahoo.es",
	"yahoo.it",
	"yahoo.co.jp",
	"yahoo.ca",
	"yahoo.com.au",
	"yahoo.in",

	// iCloud regional
	"icloud.co.uk",

	// France ISP mail brands
	"orange.fr",
	"wanadoo.fr",
	"laposte.net",

	// Germany ISP mail brands
	"web.de",

	// UK ISP mail brands
	"btinternet.com",
	"sky.com",

	// US ISP mail brands
	"comcast.net",
	"xfinity.com",
	"att.net",
	"sbcglobal.net", // AT&T (SBC Global acquired by AT&T)
	"cox.net",
	"frontier.com",
	"charter.net",
	"spectrum.net",

	// Australia ISP mail brands
	"bigpond.com",
	"bigpond.net.au",

	// Mail.ru group
	"mail.ru",
	"inbox.ru",
	"list.ru",
	"bk.ru",
	"rambler.ru",

	// Seznam (CZ)
	"seznam.cz",
	"email.cz",

	// Korea
	"naver.com",
	"daum.net",
	"hanmail.net",

	// China
	"qq.com",
	"sina.com",
	"sina.cn",
	"sohu.com",
	"163.com",
	"126.com",

	// India
	"rediffmail.com",

	// Italy
	"libero.it",

	// Smaller privacy / indie providers
	"hushmail.com",
	"runbox.com",
	"posteo.de",
	"mailbox.org",
	"disroot.org",
	"mailfence.com",
	"startmail.com",

	// Legacy providers
	"lycos.com",
]);
