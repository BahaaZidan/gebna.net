import { argon2id, argon2Verify, setWASMModules } from "argon2-wasm-edge";
// IMPORTANT: CF Workers import of wasm modules has no ?module
// @ts-expect-error: .wasm imports are provided by bundler
import argon2WASM from "argon2-wasm-edge/wasm/argon2.wasm";
// @ts-expect-error
import blake2bWASM from "argon2-wasm-edge/wasm/blake2b.wasm";

setWASMModules({ argon2WASM, blake2bWASM }); // required on Workers per README. :contentReference[oaicite:1]{index=1}

const te = new TextEncoder();
export const nowSec = () => Math.floor(Date.now() / 1000);

export function randomHex(bytes = 64) {
	const u = new Uint8Array(bytes);
	crypto.getRandomValues(u);
	return Array.from(u)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

// Hash password -> PHC ($argon2id$...)
export async function hashPassword(password: string) {
	const salt = new Uint8Array(16);
	crypto.getRandomValues(salt);
	// Choose params per RFC 9106 §4; these are reasonable edge defaults
	return argon2id({
		password,
		salt,
		parallelism: 1,
		iterations: 256,
		memorySize: 512, // KiB
		hashLength: 32,
		outputType: "encoded", // PHC string
	}); // returns PHC suitable for storage. :contentReference[oaicite:2]{index=2}
}

// Verify password vs PHC
export async function verifyPassword(phc: string, password: string) {
	return argon2Verify({ hash: phc, password });
}

// HMAC-SHA256(refresh) for DB storage (no raw refresh token in DB)
export async function hmacRefresh(env: CloudflareBindings, token: string) {
	const key = await crypto.subtle.importKey(
		"raw",
		te.encode(env.REFRESH_HMAC_KEY),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);
	const mac = await crypto.subtle.sign("HMAC", key, te.encode(token));
	return Array.from(new Uint8Array(mac))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
