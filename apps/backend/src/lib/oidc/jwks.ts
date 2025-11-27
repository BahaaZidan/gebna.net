import { pemToArrayBuffer } from "./encoding";

type PublicJwk = JsonWebKey & {
	kid: string;
	alg?: string;
	use?: string;
};

type ParsedJwks = {
	keys: PublicJwk[];
	raw: string;
};

const RSA_ALGORITHM = {
	name: "RSASSA-PKCS1-v1_5",
	hash: "SHA-256",
} as const;

let cachedJwks: ParsedJwks | null = null;
let cachedPrivateKey: { pem: string; key: CryptoKey } | null = null;
const verifyKeyCache = new Map<string, CryptoKey>();

export function getPublicJwks(env: CloudflareBindings): { keys: PublicJwk[] } {
	const raw = env.OIDC_JWKS;
	if (!raw) {
		throw new Error("OIDC_JWKS is not configured");
	}
	if (cachedJwks && cachedJwks.raw === raw) {
		return { keys: cachedJwks.keys };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		console.error("Failed to parse OIDC_JWKS JSON", error);
		throw new Error("Invalid OIDC_JWKS");
	}
	if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { keys?: unknown }).keys)) {
		throw new Error("OIDC_JWKS must include a keys array");
	}
	const keys = ((parsed as { keys: unknown[] }).keys ?? [])
		.map((entry) => entry as PublicJwk)
		.filter((entry): entry is PublicJwk => Boolean(entry) && typeof entry.kid === "string");
	if (!keys.length) {
		throw new Error("OIDC_JWKS must expose at least one key");
	}
	cachedJwks = { keys, raw };
	return { keys };
}

export async function getSigningMaterial(env: CloudflareBindings): Promise<{
	key: CryptoKey;
	header: { alg: string; kid: string };
}> {
	const jwks = getPublicJwks(env);
	const activeKey = jwks.keys[0]!;
	const alg = activeKey.alg ?? "RS256";
	const kid = activeKey.kid;
	const privateKey = await importPrivateKey(env.OIDC_PRIVATE_KEY, alg);
	return {
		key: privateKey,
		header: {
			alg,
			kid,
		},
	};
}

export async function getVerifierKey(env: CloudflareBindings, kid: string): Promise<{
	key: CryptoKey;
	alg: string;
}> {
	const cacheKey = `${kid}:${env.OIDC_JWKS}`;
	const cached = verifyKeyCache.get(cacheKey);
	if (cached) {
		const jwks = getPublicJwks(env);
		const jwk = jwks.keys.find((entry) => entry.kid === kid);
		return { key: cached, alg: jwk?.alg ?? "RS256" };
	}
	const jwks = getPublicJwks(env);
	const jwk = jwks.keys.find((entry) => entry.kid === kid);
	if (!jwk) {
		throw new Error(`Unknown JWK kid: ${kid}`);
	}
	if (jwk.kty !== "RSA") {
		throw new Error(`Unsupported JWK type: ${jwk.kty ?? "unknown"}`);
	}
	const key = await crypto.subtle.importKey("jwk", jwk, RSA_ALGORITHM, false, ["verify"]);
	verifyKeyCache.set(cacheKey, key);
	return { key, alg: jwk.alg ?? "RS256" };
}

async function importPrivateKey(pem: string | undefined, alg: string): Promise<CryptoKey> {
	if (!pem) {
		throw new Error("OIDC_PRIVATE_KEY is not configured");
	}
	if (cachedPrivateKey && cachedPrivateKey.pem === pem) {
		return cachedPrivateKey.key;
	}
	const buffer = pemToArrayBuffer(pem);
	let key: CryptoKey;
	switch (alg) {
		case "RS256":
			key = await crypto.subtle.importKey("pkcs8", buffer, RSA_ALGORITHM, false, ["sign"]);
			break;
		default:
			throw new Error(`Unsupported signing algorithm: ${alg}`);
	}
	cachedPrivateKey = { pem, key };
	return key;
}

export function buildPublicJwksResponse(env: CloudflareBindings) {
	const jwks = getPublicJwks(env);
	return {
		keys: jwks.keys.map((key) => ({
			...key,
		})),
	};
}
