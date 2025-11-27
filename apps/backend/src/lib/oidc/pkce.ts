import { base64UrlEncode, encodeText, timingSafeEqualString } from "./encoding";

export async function verifyPkceS256(codeVerifier: string, expectedChallenge: string): Promise<boolean> {
	const digest = await crypto.subtle.digest("SHA-256", encodeText(codeVerifier));
	const computedChallenge = base64UrlEncode(digest);
	return timingSafeEqualString(computedChallenge, expectedChallenge);
}
