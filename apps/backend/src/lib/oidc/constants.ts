export const ISSUER = "https://api.gebna.net";
export const AUTHORIZATION_ENDPOINT = "https://api.gebna.net/oauth2/authorize";
export const TOKEN_ENDPOINT = "https://api.gebna.net/oauth2/token";
export const USERINFO_ENDPOINT = "https://api.gebna.net/oauth2/userinfo";
export const JWKS_URI = "https://api.gebna.net/oauth2/jwks.json";

export const SUPPORTED_SCOPES = ["openid", "email", "profile", "jmap"] as const;
export type OidcScope = (typeof SUPPORTED_SCOPES)[number];

export const SUPPORTED_RESPONSE_TYPES = ["code"] as const;
export const SUPPORTED_GRANT_TYPES = ["authorization_code"] as const;
export const SUPPORTED_CLAIMS = ["sub", "email", "email_verified", "preferred_username"] as const;
export const SUPPORTED_CODE_CHALLENGE_METHODS = ["S256"] as const;

export const AUTHORIZATION_CODE_TTL_SECONDS = 60 * 5;
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const ID_TOKEN_TTL_SECONDS = 60 * 60;

export const TOKEN_TYPE = "Bearer";
export const REQUIRED_SCOPE = "openid";
