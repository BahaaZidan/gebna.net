# TASKS.md — OpenID Connect Implementation for Gebna (api.gebna.net)

## 0. Goals

Implement a fully functional **OpenID Connect (OIDC) Provider** for `https://api.gebna.net`, supporting:

- Authorization Code + PKCE (S256)
- JWT access tokens
- JWT ID tokens
- Discovery endpoints
- WebFinger integration
- JWKS endpoint
- UserInfo endpoint
- Integration with existing Gebna auth & JMAP

No dynamic client registration is required.

---

## 1. Core Constants

Define in `src/lib/oidc/constants.ts`:

- `ISSUER = "https://api.gebna.net"`
- `AUTHORIZATION_ENDPOINT = "https://api.gebna.net/oauth2/authorize"`
- `TOKEN_ENDPOINT = "https://api.gebna.net/oauth2/token"`
- `USERINFO_ENDPOINT = "https://api.gebna.net/oauth2/userinfo"`
- `JWKS_URI = "https://api.gebna.net/oauth2/jwks.json"`

Supported scopes:
- `openid`, `email`, `profile`, `jmap`

Supported grant/response types:
- `response_type=code`
- `grant_type=authorization_code`

PKCE:
- Only `S256`.

---

## 2. Database Schema Changes

### 2.1 `oidc_client` table
Stores registered OAuth/OIDC clients.

Fields:
- `id` (TEXT PK)
- `clientSecret` (TEXT nullable)
- `name`
- `redirectUris` (JSON TEXT)
- `allowedScopes` (JSON TEXT)
- `isConfidential` (BOOLEAN)
- `createdAt`, `updatedAt`

Seed at least one development client.

### 2.2 `oidc_auth_code` table
Stores short-lived authorization codes.

Fields:
- `code` (PK)
- `clientId` (FK)
- `userId` (FK)
- `redirectUri`
- `scope` (space-separated)
- `codeChallenge`
- `codeChallengeMethod` = "S256"
- `nonce` (nullable)
- `createdAt`, `expiresAt`

Lifetime: ≤ 5 minutes.

### 2.3 `oidc_token` table (optional)
Used only if refresh tokens needed.

Fields:
- `id` (PK)
- `clientId`
- `userId`
- `scope`
- `type` ("access" | "refresh" | "id")
- `expiresAt`
- `revokedAt` (nullable)

---

## 3. JWKS Support

### 3.1 Generate keypair
- Use RS256 or ES256.
- Save private key in `OIDC_PRIVATE_KEY` (Cloudflare secret).
- Save public key as static JSON or R2/KV.

### 3.2 Implement `/oauth2/jwks.json`
- Return `{ "keys": [ <public JWK> ] }`
- Public and cacheable.

---

## 4. Discovery Endpoints

### 4.1 `/.well-known/openid-configuration`
Returns JSON:

- issuer
- authorization_endpoint
- token_endpoint
- userinfo_endpoint
- jwks_uri
- supported scopes
- supported grant types
- supported response types
- supported claims
- code_challenge_methods_supported

### 4.2 `/.well-known/webfinger`
- Accepts `resource` & `rel`.
- If `rel=openid-issuer`, respond linking to the issuer.
- Otherwise return 404.

---

## 5. Authorization Endpoint (`/oauth2/authorize`)

### Input (GET)
Required:
- `response_type=code`
- `client_id`
- `redirect_uri`
- `scope` (must include `openid`)
- `state`
- `code_challenge`
- `code_challenge_method=S256`

Optional:
- `nonce`
- `login_hint`
- `prompt`

### Logic
1. Validate client and redirect URI.
2. Validate scopes.
3. If user not logged in → redirect to login preserving params.
4. After login:
   - Create auth code entry.
   - Redirect user to:
     ```
     redirect_uri?code=<code>&state=<state>
     ```

---

## 6. Token Endpoint (`/oauth2/token`)

### Input (POST, form-encoded)
Required:
- `grant_type=authorization_code`
- `code`
- `redirect_uri`
- `code_verifier`

Client auth:
- Confidential: Basic auth header or body.
- Public: no secret.

### Logic
1. Validate grant.
2. Validate client.
3. Load auth code.
4. Validate expiry, redirect URI, client match.
5. Validate PKCE: SHA256(code_verifier) base64url = stored challenge.
6. Issue:
   - Access Token (JWT)
   - ID Token (JWT)
   - Optional refresh token
7. Delete auth code (single use).

### Response
```json
{
  "access_token": "<jwt>",
  "id_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "openid email profile jmap"
}
```

---

## 7. Token Formats

### Access Token (JWT)
Claims:
- iss, sub, aud, exp, iat, scope

### ID Token (JWT)
Claims:
- iss, sub, aud, exp, iat
- nonce
- email, email_verified
- preferred_username

---

## 8. UserInfo Endpoint (`/oauth2/userinfo`)

Behavior:
1. Authenticate via Bearer JWT access token.
2. Validate token:
   - iss
   - exp
   - scope contains `openid`
3. Return allowed claims.

Example:
```json
{
  "sub": "<userid>",
  "email": "user@gebna.net",
  "email_verified": true,
  "preferred_username": "username"
}
```

---

## 9. JMAP Integration

Two options:

### Option A — Accept OIDC access tokens
- `/jmap` uses Bearer token.
- Validate via JWKS.
- Require scope contains `jmap`.

### Option B — Keep your legacy JWT
- Add OIDC support later.
- Maintain compatibility during transition.

---

## 10. Security Requirements

- No `any` types.
- Only PKCE S256.
- Auth code lifetime ≤ 5 minutes.
- Single-use auth codes.
- Access tokens expire in ~1h.
- HTTPS only.
- Use constant-time comparison for secrets.
- No implicit flow.
- Validate redirect URIs exactly.

---

## 11. Final Integration Steps

1. Create new DB tables with Drizzle.
2. Register at least one OIDC client.
3. Implement:
   - `/.well-known/openid-configuration`
   - `/.well-known/webfinger`
   - `/oauth2/jwks.json`
   - `/oauth2/authorize`
   - `/oauth2/token`
   - `/oauth2/userinfo`
4. Integrate with existing login session.
5. Integrate OIDC access tokens with `/jmap`.

---

## 12. Deliverables for Coding Agent

- All Drizzle schema files.
- All migrations.
- Hono route implementations for every endpoint.
- Token signing utilities (RS256/ES256).
- PKCE verification utilities.
- WebFinger response.
- Discovery config.
- ID token claim generator.
- Middleware for verifying OIDC access tokens for JMAP.

This file defines all tasks needed to implement OpenID Connect for Gebna.

