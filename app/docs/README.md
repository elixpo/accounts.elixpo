# Elixpo Accounts API Documentation

This folder contains API specifications for integrating with Elixpo Accounts as an OAuth 2.0 Identity Provider.

## Files

### [`LLM_SPEC.md`](./LLM_SPEC.md)
Plain-text OAuth 2.0 integration specification optimized for LLM consumption. Contains all essential information for implementing OAuth authentication with Elixpo Accounts.

**Use this if you want:**
- A quick reference guide for developers
- Copy-paste-friendly endpoint documentation
- Clear examples of request/response formats
- LLM-friendly plain text format

### [`OPENAPI_SPEC.json`](./OPENAPI_SPEC.json)
OpenAPI 3.0.0 specification for Elixpo Accounts API. Machine-readable format suitable for:
- IDE integrations and code generation
- API documentation tools (Swagger UI, Redoc)
- API testing tools (Postman, Insomnia)
- SDK generation

**Use this if you want:**
- Automated code generation
- Interactive API documentation
- IDE tooling support
- API testing integration

## Quick Start

1. **Register your OAuth app** at `https://accounts.elixpo.com/dashboard/oauth-apps`
2. **Note your credentials**: Client ID and Client Secret (shown once)
3. **Register your redirect URIs** (up to 5 per app)
4. **Follow the Authorization Code flow** in [`LLM_SPEC.md`](./LLM_SPEC.md)

## Integration Flow

```
Your App                         Elixpo Accounts
  |                                    |
  |-- 1. Redirect user to ------------>|
  |   /oauth/authorize?...            |
  |                                    |-- User logs in (if needed)
  |                                    |-- User sees consent screen
  |                                    |
  |<-- 2. Redirect back with code ----|
  |   ?code=xxx&state=yyy              |
  |                                    |
  |-- 3. POST /api/auth/token -------->|
  |   (exchange code for tokens)       |
  |                                    |
  |<-- 4. Access + Refresh tokens ----|
  |                                    |
  |-- 5. GET /api/auth/me ------------>|
  |   Authorization: Bearer <token>    |
  |                                    |
  |<-- 6. User profile data ----------|
```

## Support

For integration questions or issues, contact `accounts@elixpo.com`

---

**Live Documentation**: Visit `https://accounts.elixpo.com/docs` for an interactive version with copy-to-clipboard functionality.
