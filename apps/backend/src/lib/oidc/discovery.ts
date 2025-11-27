import {
	AUTHORIZATION_ENDPOINT,
	JWKS_URI,
	SUPPORTED_CLAIMS,
	SUPPORTED_CODE_CHALLENGE_METHODS,
	SUPPORTED_GRANT_TYPES,
	SUPPORTED_RESPONSE_TYPES,
	SUPPORTED_SCOPES,
	TOKEN_ENDPOINT,
	USERINFO_ENDPOINT,
	ISSUER,
} from "./constants";

export function buildDiscoveryDocument() {
	return {
		issuer: ISSUER,
		authorization_endpoint: AUTHORIZATION_ENDPOINT,
		token_endpoint: TOKEN_ENDPOINT,
		userinfo_endpoint: USERINFO_ENDPOINT,
		jwks_uri: JWKS_URI,
		response_types_supported: [...SUPPORTED_RESPONSE_TYPES],
		grant_types_supported: [...SUPPORTED_GRANT_TYPES],
		scopes_supported: [...SUPPORTED_SCOPES],
		claims_supported: [...SUPPORTED_CLAIMS],
		subject_types_supported: ["public"],
		code_challenge_methods_supported: [...SUPPORTED_CODE_CHALLENGE_METHODS],
		token_endpoint_auth_methods_supported: [
			"client_secret_basic",
			"client_secret_post",
			"none",
		],
		id_token_signing_alg_values_supported: ["RS256"],
	};
}
