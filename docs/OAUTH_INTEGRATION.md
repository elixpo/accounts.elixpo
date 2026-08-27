# Elixpo OAuth 2.0 Integration Guide

For third-party services integrating with Elixpo Accounts as an OAuth identity provider.

**Base URL**: `https://accounts.elixpo.com`

## Prerequisites

1. Register an OAuth app at `https://accounts.elixpo.com/dashboard/oauth-apps`
2. Save your **Client ID**. Confidential clients must also save the one-time **Client Secret**.
3. Register your **Redirect URI(s)** — HTTPS in production

## Flow Overview

Standard OAuth 2.0 Authorization Code flow:

```
Your App                         Elixpo Accounts
  |                                    |
  |-- 1. Redirect to /oauth/authorize->|
  |                                    |-- User logs in (if needed)
  |                                    |-- User sees consent screen
  |<-- 2. Redirect with code ----------|
  |                                    |
  |-- 3. POST /api/auth/token -------->|
  |<-- 4. Access + Refresh tokens -----|
  |                                    |
  |-- 5. GET /api/auth/me ------------>|
  |<-- 6. User profile data -----------|
```

## Step 1 — Authorization Request

Redirect the user to:

```
https://accounts.elixpo.com/oauth/authorize
  ?response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/callback
  &state=RANDOM_CSRF_TOKEN
  &scope=openid profile email
  &nonce=RANDOM_NONCE
  &code_challenge=BASE64URL_SHA256_CODE_VERIFIER
  &code_challenge_method=S256
```

| Parameter       | Required | Description |
|-----------------|----------|-------------|
| `response_type` | Yes      | Must be `code` |
| `client_id`     | Yes      | Your registered OAuth app's Client ID |
| `redirect_uri`  | Yes      | Must exactly match a registered redirect URI |
| `state`         | Yes      | Random string for CSRF protection — verify on callback |
| `scope`         | No       | Space-separated (default: `openid profile email`) |
| `nonce`         | Yes for OIDC | Verify this against the returned ID token |
| `code_challenge` | Yes for public clients | S256 challenge derived from the private verifier |
| `code_challenge_method` | With PKCE | Must be `S256` |

If the user is not logged in, they are redirected to the Elixpo login page and back to the consent screen automatically.

## Step 2 — Handle the Callback

**On approval:**
```
https://yourapp.com/callback?code=code_abc123...&state=YOUR_STATE
```

**On denial:**
```
https://yourapp.com/callback?error=access_denied&error_description=User+denied+access&state=YOUR_STATE
```

Always verify that `state` matches what you sent. Reject otherwise.

## Step 3 — Exchange Code for Tokens

Server-side only. Public clients use PKCE without a secret; confidential clients
also authenticate with their client secret.

```bash
curl -X POST https://accounts.elixpo.com/api/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code=code_abc123..." \
  --data-urlencode "code_verifier=YOUR_ORIGINAL_PKCE_VERIFIER" \
  --data-urlencode "client_id=YOUR_CLIENT_ID" \
  --data-urlencode "redirect_uri=https://yourapp.com/callback"
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "eyJ...",
  "id_token": "eyJ...",
  "scope": "openid profile email"
}
```

The authorization code is **single-use** and expires after 10 minutes.

## Step 4 — Fetch User Info

```bash
curl https://accounts.elixpo.com/api/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

**Response:**
```json
{
  "id": "user-uuid",
  "userId": "user-uuid",
  "email": "user@example.com",
  "displayName": "swift-falcon",
  "isAdmin": false,
  "provider": "email",
  "avatar": null,
  "emailVerified": true,
  "expiresAt": "2026-03-08T12:30:00.000Z"
}
```

## Step 5 — Refresh Tokens

Access tokens expire in 15 minutes. Use the refresh token to rotate:

```bash
curl -X POST https://accounts.elixpo.com/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "client_id": "YOUR_CLIENT_ID"
  }'
```

Refresh tokens are **rotated on each use** — the old one is revoked. Store the new one.

## Error Responses

Standard OAuth 2.0 error format:

```json
{
  "error": "invalid_client",
  "error_description": "Client not found"
}
```

| Error Code                  | HTTP | Meaning |
|-----------------------------|------|---------|
| `invalid_request`           | 400  | Missing or malformed parameters |
| `invalid_client`            | 401  | Unknown client_id or bad client_secret |
| `invalid_grant`             | 400  | Code expired, reused, or redirect mismatch |
| `access_denied`             | 403  | User denied consent |
| `unsupported_response_type` | 400  | Only `code` is supported |
| `server_error`              | 500  | Internal error — retry later or contact support |

## Example — `@elixpo/accounts`

```js
import { createAccountsClient } from "@elixpo/accounts";

const accounts = createAccountsClient({
  issuer: "https://accounts.elixpo.com",
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI,
});

const authorization = await accounts.createAuthorizationRequest();
// Store authorization.transaction in the user's server-side session, then
// redirect to authorization.url.

const tokens = await accounts.exchangeAuthorizationCode({
  code,
  codeVerifier: authorization.transaction.codeVerifier,
});

const claims = await accounts.verifyIdToken(
  tokens.idToken,
  authorization.transaction.nonce,
);
```

## Support

Issues: https://github.com/elixpo/accounts.elixpo/issues
