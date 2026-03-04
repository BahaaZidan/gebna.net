import { dbSchema, eq, type DBInstance } from "@gebna/db";
import { getDomain } from "@gebna/utils";
import { FaviconFetcher } from "@iocium/favicon-fetcher";

export type InferAddressAvatarQueueMessage = {
	type: "infer-address-avatar";
	payload: {
		address: string;
	};
};

/** Encapsulates address avatar inference and processing */
export async function inferAddressAvatar({
	db,
	address,
}: { db: DBInstance } & InferAddressAvatarQueueMessage["payload"]): Promise<void> {
	const addressRecord = await db.query.emailAddresses.findFirst({ where: { address } });
	if (!addressRecord) return;

	const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
	const isInferenceOlderThan7Days = Date.now() - addressRecord.updatedAt.getTime() > SEVEN_DAYS_MS;
	if (!isInferenceOlderThan7Days && addressRecord.inferredAvatar) return;

	const inferredAvatar = await resolveAvatar(address).catch(() => undefined);
	if (!inferredAvatar) return;

	await db
		.update(dbSchema.emailAddresses)
		.set({ inferredAvatar, updatedAt: new Date() })
		.where(eq(dbSchema.emailAddresses.address, address));
}

async function resolveAvatar(address: string): Promise<string | null> {
	const domain = getDomain(address);
	if (!domain) return null;

	if (AVATAR_INFERENCE_DENYLIST.has(domain)) return null;

	const fetcher = new FaviconFetcher(domain);
	const favicon = await fetcher.fetchFavicon();

	return favicon.url;
}

/** We don't want to try to infer personal email providers */
export const AVATAR_INFERENCE_DENYLIST = new Set([
	"gebna.net",

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
