const MAX_ID_COUNT = 100;

export function extractMessageIdsFromPostalMimeValue(value?: string | null): string[] {
	if (!value) return [];

	const out: string[] = [];
	const seen = new Set<string>();

	const matches = value.match(/<[^<>\s]+>/g) ?? [];

	for (const m of matches) {
		const id = m.trim();

		// RFC 5322 msg-id requires an "@"
		if (!id.includes("@")) continue;

		if (!seen.has(id)) {
			seen.add(id);
			out.push(id);
			if (out.length >= MAX_ID_COUNT) break;
		}
	}

	return out;
}
