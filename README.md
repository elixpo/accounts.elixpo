<div align="center">
  <img src="https://github.com/user-attachments/assets/a2057d99-fc2d-4e19-ab16-661a403bc0ec" alt="Elixpo Accounts Banner" width="600"/>
  <h1>🔐 Elixpo Accounts</h1>
  <p><em>The central identity and SSO gateway for the Elixpo ecosystem.</em></p>
</div>

---

## 🌟 What is this?
Welcome to **Elixpo Accounts**! Instead of forcing users to create a new username and password for every single Elixpo tool, this acts as our Single Sign-On (SSO) service. 

If you want to use our chat application, news feed, or any other platform we build, your journey starts here. Register once, and get seamless access everywhere.

## ✨ Key Features
* **Universal Access:** One account to access all Elixpo projects.
* **Flexible Login:** Sign in securely using your existing Google or GitHub accounts, or stick to a traditional Email login.
* **Centralized Dashboard:** Manage your active sessions, connected services, and security settings all in one clean interface.
* **OAuth 2.0 Integration:** Standardized OAuth 2.0 Authorization Code flow for third-party applications.

## 🔗 Integration & Documentation

**For developers integrating with Elixpo Accounts:**

- **[API Documentation](./app/docs/README.md)** — Complete OAuth 2.0 integration guide
- **[LLM Specification](./app/docs/LLM_SPEC.md)** — Plain-text spec optimized for LLM consumption
- **[OpenAPI Spec](./app/docs/OPENAPI_SPEC.json)** — Machine-readable API specification (OpenAPI 3.0.0)
- **[Interactive Docs](https://accounts.elixpo.com/docs)** — Live documentation with copy-to-clipboard functionality

### Quick Integration

```bash
# 1. Register your OAuth app at https://accounts.elixpo.com/dashboard/oauth-apps
# 2. Get your Client ID & Client Secret
# 3. Follow the OAuth 2.0 Authorization Code flow in the docs above
```

## 💻 Built With
For developers looking to contribute, this project is built on a modern, fast, and scalable stack:
* **Framework:** Next.js (App Router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **Infrastructure:** Cloudflare Routing & Cloudflare D1 (Database)
* **Containerization:** Docker

---
*Maintained by the Elixpo Open Source Team.*
