/* ============================================================
   Domain avatar resolver for Cloudflare Workers (single file)
   Prefers:
     1) BIMI (exact domain, then apex)
     2) Favicon (exact domain, then apex)
   Strategy (NO in-betweens):
     a.b.c.cloudflare.com -> try a.b.c.cloudflare.com, then cloudflare.com

   - Workers-native (fetch + caches.default)
   - PSL-aware apex via tldts (installed)
   - Retry + timeout
   - Optional verification (BIMI logo + favicon)
   - Positive + negative caching
   ============================================================ */

import { getDomain as getRegistrableDomain } from "tldts";

/* ================= Public API ================= */
export type GetDomainAvatarOptions = {
	/* ---------- DNS / BIMI ---------- */
	dohUrl?: string;
	dnsRetries?: number;
	dnsTimeoutMs?: number;

	/* ---------- HTTP ---------- */
	httpRetries?: number;
	fetchTimeoutMs?: number;
	userAgent?: string;

	/* ---------- Verification ---------- */
	verifyBimiUrl?: boolean; // default true
	verifyFaviconUrl?: boolean; // default true
	strictImageContentType?: boolean; // default true (for favicons)

	/* ---------- Caching ---------- */
	cacheTtlSeconds?: number; // positive cache TTL
	negativeCacheTtlSeconds?: number; // negative cache TTL

	/* If present, clamp DNS TTL into this range (for BIMI). */
	minDnsTtlSeconds?: number;
	maxDnsTtlSeconds?: number;
};

export type DomainAvatarResult = {
	avatarUrl: string | null;
	avatarDomainUsed: string | null;
	/**
	 * - bimi_exact/bimi_apex: returned URL came from BIMI l=
	 * - favicon_*: returned URL came from favicon strategy
	 * - none: nothing found
	 */
	source:
		| "bimi_exact"
		| "bimi_apex"
		| "favicon_ico_exact"
		| "favicon_ico_apex"
		| "favicon_html_exact"
		| "favicon_html_apex"
		| "none";
};

const DEFAULTS: Required<GetDomainAvatarOptions> = {
	dohUrl: "https://cloudflare-dns.com/dns-query",
	dnsRetries: 2,
	dnsTimeoutMs: 1800,

	httpRetries: 1,
	fetchTimeoutMs: 2500,
	userAgent: "Mozilla/5.0 (compatible; GebnaAvatarBot/1.0; +https://gebna.net)",

	verifyBimiUrl: true,
	verifyFaviconUrl: true,
	strictImageContentType: true,

	cacheTtlSeconds: 6 * 60 * 60, // 6h
	negativeCacheTtlSeconds: 24 * 60 * 60, // 24h

	minDnsTtlSeconds: 300, // 5 min
	maxDnsTtlSeconds: 24 * 60 * 60, // 24h
};

/**
 * Convenience: returns only the URL.
 */
export async function getDomainAvatarUrl(
	inputDomain: string,
	opts: GetDomainAvatarOptions = {}
): Promise<string | null> {
	const r = await getDomainAvatar(inputDomain, opts);
	return r.avatarUrl;
}

function getDefaultCache(): Cache {
	return (caches as unknown as { default: Cache }).default;
}

/**
 * Full result with provenance.
 */
export async function getDomainAvatar(
	inputDomain: string,
	opts: GetDomainAvatarOptions = {}
): Promise<DomainAvatarResult> {
	const options = { ...DEFAULTS, ...opts };

	const exact = normalizeDomain(inputDomain);
	if (!exact) return { avatarUrl: null, avatarDomainUsed: null, source: "none" };

	const apex = getApexDomain(exact);

	const candidates: Array<{ domain: string; kind: "exact" | "apex" }> = [
		{ domain: exact, kind: "exact" },
	];
	if (apex && apex !== exact) candidates.push({ domain: apex, kind: "apex" });

	const cacheKey = new Request(
		`https://domain-avatar/v1?exact=${encodeURIComponent(exact)}&apex=${encodeURIComponent(apex ?? "")}`
	);

	const cached = await getDefaultCache().match(cacheKey);
	if (cached) return (await cached.json()) as DomainAvatarResult;

	// 1) BIMI first (exact -> apex)
	for (const c of candidates) {
		const { txt, ttlSeconds } = await resolveTxtViaDoh(`default._bimi.${c.domain}`, options);
		const logoUrl = txt ? parseBimiLogoUrl(txt) : null;
		if (!logoUrl) continue;

		const ok =
			!options.verifyBimiUrl ||
			(await looksLikeReachableImage(logoUrl, options.fetchTimeoutMs, options.userAgent));

		if (!ok) continue;

		const result: DomainAvatarResult = {
			avatarUrl: logoUrl,
			avatarDomainUsed: c.domain,
			source: c.kind === "exact" ? "bimi_exact" : "bimi_apex",
		};

		// Prefer DNS TTL if present, but clamp it to safe range.
		const ttl = clampTtl(
			ttlSeconds ?? options.cacheTtlSeconds,
			options.minDnsTtlSeconds,
			options.maxDnsTtlSeconds
		);

		await putJsonCache(cacheKey, result, ttl);
		return result;
	}

	// 2) Favicon fallback (exact -> apex)
	for (const c of candidates) {
		// Fast path: /favicon.ico
		const icoUrl = `https://${c.domain}/favicon.ico`;

		if (
			!options.verifyFaviconUrl ||
			(await looksLikeImageUrl(
				icoUrl,
				options.fetchTimeoutMs,
				options.userAgent,
				options.strictImageContentType
			))
		) {
			const result: DomainAvatarResult = {
				avatarUrl: icoUrl,
				avatarDomainUsed: c.domain,
				source: c.kind === "exact" ? "favicon_ico_exact" : "favicon_ico_apex",
			};

			await putJsonCache(cacheKey, result, options.cacheTtlSeconds);
			return result;
		}

		// Homepage HTML icon discovery
		const html = await fetchTextWithRetries(`https://${c.domain}/`, options);
		if (!html) continue;

		const iconCandidates = extractIconCandidatesFromHtml(html, `https://${c.domain}/`);
		for (const href of iconCandidates) {
			const abs = toAbsoluteUrl(href, `https://${c.domain}/`);
			if (!abs) continue;
			if (!abs.startsWith("https://")) continue;

			if (
				!options.verifyFaviconUrl ||
				(await looksLikeImageUrl(
					abs,
					options.fetchTimeoutMs,
					options.userAgent,
					options.strictImageContentType
				))
			) {
				const result: DomainAvatarResult = {
					avatarUrl: abs,
					avatarDomainUsed: c.domain,
					source: c.kind === "exact" ? "favicon_html_exact" : "favicon_html_apex",
				};

				await putJsonCache(cacheKey, result, options.cacheTtlSeconds);
				return result;
			}
		}
	}

	const none: DomainAvatarResult = { avatarUrl: null, avatarDomainUsed: null, source: "none" };
	await putJsonCache(cacheKey, none, options.negativeCacheTtlSeconds);
	return none;
}

/* ================= Apex (PSL-aware via tldts) ================= */

function getApexDomain(host: string): string | null {
	const d = getRegistrableDomain(host);
	return d ? normalizeDomain(d) : null;
}

/* ================= caches.default ================= */

async function putJsonCache(key: Request, value: unknown, ttlSeconds: number): Promise<void> {
	await getDefaultCache().put(
		key,
		new Response(JSON.stringify(value), {
			headers: {
				"content-type": "application/json",
				"cache-control": `max-age=${Math.max(1, Math.floor(ttlSeconds))}`,
			},
		})
	);
}

function clampTtl(ttl: number, min: number, max: number): number {
	if (!Number.isFinite(ttl) || ttl <= 0) return min;
	return Math.max(min, Math.min(max, Math.floor(ttl)));
}

/* ================= BIMI via DoH ================= */

type DohAnswer = {
	data: string;
	type: number;
	TTL?: number;
};

type DohResponse = {
	Status?: number;
	Answer?: DohAnswer[];
};

async function resolveTxtViaDoh(
	name: string,
	options: Required<GetDomainAvatarOptions>
): Promise<{ txt: string | null; ttlSeconds: number | null }> {
	const url = new URL(options.dohUrl);
	url.searchParams.set("name", name);
	url.searchParams.set("type", "TXT");

	for (let i = 0; i <= options.dnsRetries; i++) {
		const res = await tryFetchJson<DohResponse>(url.toString(), options.dnsTimeoutMs, options.userAgent);

		if (res?.Status === 0 && Array.isArray(res.Answer)) {
			let minTtl: number | null = null;

			const records: string[] = res.Answer.filter(
				(a): a is DohAnswer => a?.type === 16 && typeof a?.data === "string"
			)
				.map((a) => {
					const ttl = typeof a?.TTL === "number" ? a.TTL : null;
					if (ttl !== null) minTtl = minTtl === null ? ttl : Math.min(minTtl, ttl);
					return stripOuterQuotes(String(a.data));
				})
				.filter((r) => Boolean(r));

			if (!records.length) return { txt: null, ttlSeconds: minTtl };

			records.sort((a, b) => scoreBimiTxt(b) - scoreBimiTxt(a));
			return { txt: records.join(" "), ttlSeconds: minTtl };
		}

		if (i === options.dnsRetries) return { txt: null, ttlSeconds: null };
		await sleep(backoffMs(i));
	}

	return { txt: null, ttlSeconds: null };
}

function parseBimiLogoUrl(txt: string): string | null {
	const parts = txt
		.split(";")
		.map((p) => p.trim())
		.filter(Boolean);
	const kv = new Map<string, string>();

	for (const p of parts) {
		const i = p.indexOf("=");
		if (i === -1) continue;
		kv.set(p.slice(0, i).trim().toLowerCase(), p.slice(i + 1).trim());
	}

	if ((kv.get("v") ?? "").toUpperCase() !== "BIMI1") return null;

	const l = kv.get("l");
	if (!l) return null;

	try {
		const u = new URL(l);
		return u.protocol === "https:" ? u.toString() : null;
	} catch {
		return null;
	}
}

function scoreBimiTxt(txt: string): number {
	const t = txt.toLowerCase();
	return (t.includes("v=bimi1") ? 10 : 0) + (t.includes("l=") ? 3 : 0);
}

/* ================= Favicon logic ================= */

async function fetchTextWithRetries(
	url: string,
	options: Required<GetDomainAvatarOptions>
): Promise<string | null> {
	for (let i = 0; i <= options.httpRetries; i++) {
		const res = await fetchWithTimeout(
			url,
			{
				method: "GET",
				headers: {
					"user-agent": options.userAgent,
					accept: "text/html,application/xhtml+xml",
				},
			},
			options.fetchTimeoutMs
		);

		if (res?.ok) {
			const ct = res.headers.get("content-type")?.toLowerCase() ?? "";
			if (!ct.includes("text/html") && !ct.includes("application/xhtml+xml")) return null;
			try {
				return await res.text();
			} catch {
				return null;
			}
		}

		if (i === options.httpRetries) return null;
		await sleep(backoffMs(i));
	}

	return null;
}

function extractIconCandidatesFromHtml(html: string, baseUrl: string): string[] {
	const out: string[] = [];

	// Priority order
	const relPatterns = [
		/<link\b[^>]*\brel\s*=\s*["']apple-touch-icon["'][^>]*>/gi,
		/<link\b[^>]*\brel\s*=\s*["']apple-touch-icon-precomposed["'][^>]*>/gi,
		/<link\b[^>]*\brel\s*=\s*["']icon["'][^>]*>/gi,
		/<link\b[^>]*\brel\s*=\s*["']shortcut icon["'][^>]*>/gi,
	];

	for (const relRe of relPatterns) {
		let m: RegExpExecArray | null;
		while ((m = relRe.exec(html)) !== null) {
			const tag = m[0];
			const href = extractAttr(tag, "href");
			if (href) out.push(href);
		}
	}

	// More permissive pass: rel contains "icon"
	const generic = /<link\b[^>]*\brel\s*=\s*["'][^"']*icon[^"']*["'][^>]*>/gi;
	let mg: RegExpExecArray | null;
	while ((mg = generic.exec(html)) !== null) {
		const tag = mg[0];
		const href = extractAttr(tag, "href");
		if (href) out.push(href);
	}

	// Dedupe in order
	const seen = new Set<string>();
	const deduped: string[] = [];
	for (const h of out) {
		const abs = toAbsoluteUrl(h, baseUrl) ?? h;
		const key = abs.trim();
		if (!key) continue;
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push(h);
	}

	return deduped;
}

function extractAttr(tag: string, attr: string): string | null {
	const re = new RegExp(`\\b${attr}\\s*=\\s*["']([^"']+)["']`, "i");
	const m = re.exec(tag);
	return m?.[1] ?? null;
}

function toAbsoluteUrl(href: string, base: string): string | null {
	try {
		return new URL(href, base).toString();
	} catch {
		return null;
	}
}

async function looksLikeReachableImage(
	url: string,
	timeoutMs: number,
	userAgent: string
): Promise<boolean> {
	// HEAD first, then GET Range fallback.
	const head = await fetchHead(url, timeoutMs, userAgent);
	if (head.ok && isImageType(head.contentType)) return true;

	const get = await fetchRange(url, timeoutMs, userAgent);
	return get.ok && (!get.contentType || isImageType(get.contentType));
}

async function looksLikeImageUrl(
	url: string,
	timeoutMs: number,
	userAgent: string,
	strictContentType: boolean
): Promise<boolean> {
	const head = await fetchHead(url, timeoutMs, userAgent);
	if (head.ok && isImageContentType(head.contentType, strictContentType)) return true;

	const get = await fetchRange(url, timeoutMs, userAgent);
	if (!get.ok) return false;

	return isImageContentType(get.contentType, strictContentType);
}

function isImageType(ct: string | null): boolean {
	return !!ct && ct.toLowerCase().startsWith("image/");
}

function isImageContentType(ct: string | null, strict: boolean): boolean {
	if (!ct) return !strict; // strict -> reject missing CT, non-strict -> allow
	return ct.toLowerCase().startsWith("image/");
}

async function fetchHead(
	url: string,
	timeoutMs: number,
	userAgent: string
): Promise<{ ok: boolean; contentType: string | null }> {
	const res = await fetchWithTimeout(
		url,
		{ method: "HEAD", headers: { "user-agent": userAgent, accept: "image/*,*/*" } },
		timeoutMs
	);
	return { ok: !!res?.ok, contentType: res?.headers.get("content-type") ?? null };
}

async function fetchRange(
	url: string,
	timeoutMs: number,
	userAgent: string
): Promise<{ ok: boolean; contentType: string | null }> {
	const res = await fetchWithTimeout(
		url,
		{
			method: "GET",
			headers: { "user-agent": userAgent, accept: "image/*,*/*", Range: "bytes=0-2047" },
		},
		timeoutMs
	);
	return { ok: !!res?.ok, contentType: res?.headers.get("content-type") ?? null };
}

/* ================= Shared utilities ================= */

function normalizeDomain(input: string): string | null {
	let host = input.trim();
	if (!host) return null;

	try {
		if (host.includes("://")) host = new URL(host).hostname;
	} catch {
		// ignore invalid URLs and fall back to raw input
	}

	host = host.toLowerCase();
	if (host.endsWith(".")) host = host.slice(0, -1);

	if (host.length > 253) return null;

	const labels = host.split(".");
	if (labels.length < 2) return null;

	for (const l of labels) {
		if (l.length === 0 || l.length > 63) return null;
		if (!/^[a-z0-9-]+$/.test(l) || l.startsWith("-") || l.endsWith("-")) return null;
	}

	return host;
}

function stripOuterQuotes(s: string): string {
	return s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

async function tryFetchJson<T = unknown>(
	url: string,
	timeoutMs: number,
	userAgent: string
): Promise<T | null> {
	const res = await fetchWithTimeout(
		url,
		{ method: "GET", headers: { accept: "application/dns-json", "user-agent": userAgent } },
		timeoutMs
	);
	if (!res?.ok) return null;
	try {
		return await res.json();
	} catch {
		return null;
	}
}

async function fetchWithTimeout(
	url: string,
	init: RequestInit,
	ms: number
): Promise<Response | null> {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), ms);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} catch {
		return null;
	} finally {
		clearTimeout(id);
	}
}

function backoffMs(i: number): number {
	return Math.min(800, 100 * 2 ** i) + Math.random() * 100;
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
