import { DBInstance } from "$lib/db";

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
	const isGebnaSender = normalizedAddress.endsWith("@gebna.net");

	if (isGebnaSender) {
		const sender = await db.query.userTable.findFirst({
			where: (t, { eq }) => eq(t.username, extractLocalPart(normalizedAddress)),
		});
		if (sender) return sender.avatar || sender.avatarPlaceholder;
	}

	return inferAvatar(normalizedAddress);
}

async function inferAvatar(address: string): Promise<string | undefined> {
	const normalizedAddress = address.trim().toLowerCase();
	const domain = normalizedAddress.split("@")[1];
	const gravatarHash = await md5Hex(normalizedAddress);

	const primaryCandidates = [
		`https://unavatar.io/${encodeURIComponent(normalizedAddress)}`,
		`https://www.gravatar.com/avatar/${gravatarHash}?d=404`,
		domain ? `https://logo.clearbit.com/${domain}` : null,
		domain ? `https://unavatar.io/${encodeURIComponent(domain)}` : null,
	].filter(Boolean) as string[];

	if (!primaryCandidates.length) return domain ? getBimiLogo(domain) : undefined;

	const primaryResult = await raceReachable(primaryCandidates);
	if (primaryResult) return primaryResult;

	return domain ? getBimiLogo(domain) : undefined;
}

function raceReachable(urls: string[]): Promise<string | undefined> {
	return new Promise((resolve) => {
		let resolved = false;
		let remaining = urls.length;

		for (const url of urls) {
			isReachable(url)
				.then((ok) => {
					if (ok && !resolved) {
						resolved = true;
						resolve(url);
					}
				})
				.catch(() => {})
				.finally(() => {
					remaining -= 1;
					if (!resolved && remaining === 0) resolve(undefined);
				});
		}
	});
}

async function isReachable(url: string) {
	try {
		const response = await fetch(url, { method: "HEAD" });
		return response.ok;
	} catch {
		return false;
	}
}

async function getBimiLogo(domain: string): Promise<string | undefined> {
	try {
		const res = await fetch(`https://dns.google/resolve?name=default._bimi.${domain}&type=TXT`);
		if (!res.ok) return undefined;
		const data = (await res.json()) as { Answer?: Array<{ data: string }> };
		const records = data.Answer?.map((a) => a.data) ?? [];
		for (const raw of records) {
			const cleaned = raw.replace(/^"+|"+$/g, "");
			const match = cleaned.match(/(?:^|\\s|;)l=([^;\\s]+)/);
			const logo = match?.[1];
			if (logo && (logo.startsWith("http://") || logo.startsWith("https://"))) {
				if (await isReachable(logo)) return logo;
			}
		}
		return undefined;
	} catch {
		return undefined;
	}
}

async function md5Hex(input: string) {
	const encoder = new TextEncoder();
	const hashBuffer = await crypto.subtle.digest("MD5", encoder.encode(input));
	const bytes = new Uint8Array(hashBuffer);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
