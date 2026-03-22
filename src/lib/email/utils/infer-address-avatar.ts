import { FaviconFetcher } from "@iocium/favicon-fetcher";
import { eq } from "drizzle-orm";
import { getDomain } from "tldts";

import { dbSchema, type DBInstance } from "#/lib/db";

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
}: {
	db: DBInstance;
} & InferAddressAvatarQueueMessage["payload"]): Promise<void> {
	const addressRecord = await db.query.emailAddresses.findFirst({
		where: { address },
	});
	if (!addressRecord) return;

	const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
	const isInferenceOlderThan7Days =
		Date.now() - addressRecord.updatedAt.getTime() > SEVEN_DAYS_MS;
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
	const bimi = await fetcher.fetchFavicon("bimi").catch(() => null);
	if (bimi) return bimi.url;

	const favicon = await fetcher.fetchFavicon("faviconis").catch(() => null);
	if (favicon) {
		const content = Buffer.from(favicon.content).toString("utf8");
		if (content.trim() === FAVICON_PLACEHOLDER.trim()) return null;

		return favicon.url;
	}

	return null;
}

/** We don't want to try to infer personal email providers */
const AVATAR_INFERENCE_DENYLIST = new Set([
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

const FAVICON_PLACEHOLDER = `
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="100%" height="100%" viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">
    <g transform="matrix(1,0,0,1,-78.505,-102.675)">
        <circle cx="334.534" cy="357.264" r="243.481" style="fill:rgb(196,196,196);"/>
    </g>
    <g transform="matrix(1,0,0,1,-44.1325,-117.882)">
        <g transform="matrix(530,0,0,530,457.423,564.535)">
        </g>
        <text x="146.843px" y="564.535px" style="font-family:'TitanOne', 'Titan One';font-size:530px;fill:white;">F</text>
    </g>
</svg>
`;
