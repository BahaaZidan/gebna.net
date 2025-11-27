const textEncoder = new TextEncoder();

export function encodeText(input: string): Uint8Array {
	return textEncoder.encode(input);
}

export function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
	const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]!);
	}
	const base64 = btoa(binary);
	return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlEncodeJSON(value: unknown): string {
	const json = typeof value === "string" ? value : JSON.stringify(value);
	return base64UrlEncode(encodeText(json));
}

export function base64UrlDecode(input: string): Uint8Array {
	const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
	const padding = normalized.length % 4;
	const padded = normalized + (padding ? "=".repeat(4 - padding) : "");
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	const length = Math.max(a.length, b.length);
	let mismatch = a.length ^ b.length;
	for (let i = 0; i < length; i++) {
		const aByte = a[i] ?? 0;
		const bByte = b[i] ?? 0;
		mismatch |= aByte ^ bByte;
	}
	return mismatch === 0;
}

export function timingSafeEqualString(a: string, b: string): boolean {
	return timingSafeEqual(encodeText(a), encodeText(b));
}

export function pemToArrayBuffer(pem: string): ArrayBuffer {
	const normalized = pem
		.replace(/-----BEGIN [^-]+-----/g, "")
		.replace(/-----END [^-]+-----/g, "")
		.replace(/\s+/g, "");
	const binary = atob(normalized);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}
