import { AVATAR_INFERENCE_DENYLIST } from "$lib/constant";
import { DBInstance } from "$lib/db";

import { getDomainAvatarUrl } from "./bimi";

export function extractLocalPart(email: string) {
	const atIndex = email.indexOf("@");
	const lastAtIndex = email.lastIndexOf("@");

	if (atIndex <= 0 || atIndex !== lastAtIndex || atIndex === email.length - 1) {
		throw new Error("Invalid email address");
	}

	const localWithTag = email.slice(0, atIndex);
	const plusIndex = localWithTag.indexOf("+");

	return plusIndex === -1 ? localWithTag : localWithTag.slice(0, plusIndex);
}

export async function resolveAvatar(db: DBInstance, address: string) {
	const normalizedAddress = address.trim().toLowerCase();
	const atIndex = normalizedAddress.indexOf("@");
	if (atIndex === -1 || atIndex === normalizedAddress.length - 1) return undefined;
	const domain = normalizedAddress.slice(atIndex + 1);
	if (!domain) return undefined;

	if (domain === "gebna.net") {
		const sender = await db.query.userTable.findFirst({
			where: (t, { eq }) => eq(t.username, extractLocalPart(normalizedAddress)),
		});
		return sender?.avatar;
	}
	if (AVATAR_INFERENCE_DENYLIST.has(domain)) return;

	const bimiLogo = await getDomainAvatarUrl(domain);
	return bimiLogo;
}
