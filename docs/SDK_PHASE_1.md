# Elixpo Accounts SDK — Phase 1

Package: `@elixpo/accounts@0.1.0-beta.1`

## Server contract

- OAuth metadata: `/.well-known/oauth-authorization-server`
- OpenID metadata: `/.well-known/openid-configuration`
- Signing keys: `/.well-known/jwks.json`
- Authorization: `/oauth/authorize`
- Token exchange/refresh: `/api/auth/token`
- Revocation: `/api/auth/revoke`
- User info: `/api/auth/me`

Metadata and endpoint URLs use the configured issuer. Production URLs must use
HTTPS. Public authorization-code clients must use S256 PKCE.

## Compatibility policy

- `elixpo_contract_version` changes when the public protocol contract changes.
- Additive metadata fields are backward-compatible.
- Removed fields, changed semantics, or newly required inputs require a contract
  version change and migration notes.
- The SDK validates issuer, endpoint origin, S256 support, signing algorithm,
  key ID, token audience, expiry, type, and nonce.

## Token storage contract

Refresh responses always contain a replacement refresh token. Consumers must
write the new token atomically before discarding the old value. Reusing the old
token revokes its token family.

SDK errors never include token endpoint response descriptions because providers
can accidentally echo authorization codes, verifiers, tokens, or secrets.

## Phase boundary

Phase 1 contains protocol primitives only. Next.js middleware, encrypted cookie
sessions, React providers, hooks, and UI components belong to Phase 2.
