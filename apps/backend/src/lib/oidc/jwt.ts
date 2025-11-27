import { base64UrlDecode, base64UrlEncode, base64UrlEncodeJSON, encodeText } from "./encoding";
import { getSigningMaterial, getVerifierKey } from "./jwks";

export type JwtHeader = {
	alg: string;
	kid: string;
	typ: "JWT";
};

export type JwtPayload = Record<string, unknown>;

export async function signJwt(env: CloudflareBindings, payload: JwtPayload): Promise<string> {
	const { key, header } = await getSigningMaterial(env);
	const jwtHeader: JwtHeader = { alg: header.alg, kid: header.kid, typ: "JWT" };
	const headerSegment = base64UrlEncodeJSON(jwtHeader);
	const payloadSegment = base64UrlEncodeJSON(payload);
	const signingInput = `${headerSegment}.${payloadSegment}`;
	const signature = await crypto.subtle.sign(
		{ name: header.alg === "RS256" ? "RSASSA-PKCS1-v1_5" : header.alg },
		key,
		encodeText(signingInput)
	);
	const signatureSegment = base64UrlEncode(signature);
	return `${signingInput}.${signatureSegment}`;
}

export async function verifyJwt<TPayload extends JwtPayload>(
	env: CloudflareBindings,
	token: string
): Promise<{ header: JwtHeader; payload: TPayload }> {
	const parts = token.split(".");
	if (parts.length !== 3) {
		throw new Error("Invalid JWT structure");
	}
	const headerJson = new TextDecoder().decode(base64UrlDecode(parts[0]!));
	const payloadJson = new TextDecoder().decode(base64UrlDecode(parts[1]!));
	let header: JwtHeader;
	let payload: TPayload;
	try {
		header = JSON.parse(headerJson) as JwtHeader;
		payload = JSON.parse(payloadJson) as TPayload;
	} catch (error) {
		console.error("Failed to parse JWT segments", error);
		throw new Error("Invalid JWT payload");
	}
	if (!header.kid) {
		throw new Error("JWT missing kid");
	}
	const { key, alg } = await getVerifierKey(env, header.kid);
	const signingInput = `${parts[0]}.${parts[1]}`;
	const signature = base64UrlDecode(parts[2]!);
	const isValid = await crypto.subtle.verify(
		{ name: alg === "RS256" ? "RSASSA-PKCS1-v1_5" : alg },
		key,
		signature,
		encodeText(signingInput)
	);
	if (!isValid) {
		throw new Error("JWT signature verification failed");
	}
	return { header, payload };
}
