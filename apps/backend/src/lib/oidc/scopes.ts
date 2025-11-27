import { REQUIRED_SCOPE, SUPPORTED_SCOPES } from "./constants";
import type { OidcClient } from "./clients";

export function parseScope(value: string): string[] {
	return value
		.split(" ")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)
		.filter((entry, index, arr) => arr.indexOf(entry) === index);
}

export function ensureScopesAllowed(scopes: string[], client: OidcClient): void {
	const supported = new Set<string>(SUPPORTED_SCOPES);
	const allowed = new Set(client.allowedScopes);
	for (const scope of scopes) {
		if (!supported.has(scope)) {
			throw new Error(`Unsupported scope: ${scope}`);
		}
		if (!allowed.has(scope)) {
			throw new Error(`Scope not allowed for this client: ${scope}`);
		}
	}
	if (!scopes.includes(REQUIRED_SCOPE)) {
		throw new Error("Scope must include openid");
	}
}
