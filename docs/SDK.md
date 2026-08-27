# Elixpo Accounts SDK

Package: `@elixpo/accounts`

## Core API

The Phase 1 core is runtime-neutral and uses Web Crypto and `fetch`:

- OAuth/OIDC discovery and JWKS retrieval
- S256 PKCE, state, nonce, and authorization callback validation
- authorization-code exchange, refresh rotation, and revocation
- access-token and ID-token verification
- sanitized, typed protocol errors

Public clients must use S256 PKCE. Confidential clients additionally keep the
client secret on the server. Refresh responses replace the previous refresh
token and must be stored atomically.

## Phase 2

Phase 2 adds framework integrations without weakening the core contract:

- `@elixpo/accounts/next` route handlers and encrypted cookie sessions
- `@elixpo/accounts/react` provider and account-aware hooks
- sign-in, sign-out, callback, and account-switch helpers
- server-side session and authorization guards

Framework adapters will call the core package; they will not duplicate token or
PKCE logic. Hosted Elixpo pages remain responsible for credentials, passkeys,
OTP, MFA, consent, and account selection.

## Compatibility

- `elixpo_contract_version` changes when the public protocol changes.
- Additive metadata fields are backward-compatible.
- Removed fields, changed semantics, or newly required inputs need migration
  notes and a contract-version change.
- Prereleases use the npm `beta` tag until the adapter APIs stabilize.
