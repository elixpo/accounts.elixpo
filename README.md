<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=180&section=header&text=Elixpo%20Accounts&fontSize=52&fontColor=ffffff&fontAlignY=38&desc=One%20login%20for%20everything%20Elixpo&descAlignY=62&descAlign=50" width="100%" alt="Elixpo Accounts" />

<br/>

<img src="https://raw.githubusercontent.com/elixpo/accounts.elixpo/main/public/og-image.png" alt="Elixpo Accounts" width="720"/>

<br/><br/>

[![License](https://img.shields.io/github/license/elixpo/accounts.elixpo?style=flat-square&color=blue)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/elixpo/accounts.elixpo?style=flat-square&color=informational)](https://github.com/elixpo/accounts.elixpo/commits/main)
[![Issues](https://img.shields.io/github/issues/elixpo/accounts.elixpo?style=flat-square&color=yellow)](https://github.com/elixpo/accounts.elixpo/issues)
[![Stars](https://img.shields.io/github/stars/elixpo/accounts.elixpo?style=flat-square&color=gold)](https://github.com/elixpo/accounts.elixpo/stargazers)

</div>

---

## What is this?

**Elixpo Accounts** is your single login for every Elixpo product — chat, art, blogs, sketch, the URL shortener, and anything else we build.

Make one account here, and you're signed in everywhere. No separate passwords. No juggling logins.

For your everyday use, you don't need to touch this repo at all — just go to **[accounts.elixpo.com](https://accounts.elixpo.com)** and sign up.

---

## What can I do with my account?

- **Sign in once.** Use your Elixpo account on any Elixpo site without making a new login.
- **Choose how to sign in.** Email + password, Google, or GitHub — pick whichever you prefer.
- **Manage your profile in one place.** Update your display name, picture, and bio. Every Elixpo product stays in sync.
- **See which apps you've connected.** Visit your dashboard to view and remove app access whenever you want.
- **Delete your account properly.** One click here removes you from every Elixpo product — no orphaned data left behind.

---

## I'm a developer — can I let users sign in with Elixpo?

Yes. Anyone can register an app and add a "Sign in with Elixpo" button on their site.

1. Sign in at [accounts.elixpo.com](https://accounts.elixpo.com).
2. Open the dashboard → **OAuth Apps** → register a new app.
3. Follow the integration guide: **[docs/OAUTH_INTEGRATION.md](docs/OAUTH_INTEGRATION.md)**.

You also get webhook events (like "user deleted their account") so your app can stay in sync automatically.

---

## Architecture

How accounts.elixpo connects to the rest of the Elixpo ecosystem (Pay for billing, Mails for transactional email) and how Razorpay sits in the loop for INR autopay.

```mermaid
flowchart TB
    subgraph BROWSER ["User's Browser"]
        U[User]
    end

    subgraph ACCOUNTS ["accounts.elixpo.com (Cloudflare Pages)"]
        AUI["UI: /pricing /dashboard/subscriptions /login"]
        AAPI["API routes:<br/>/api/billing/checkout<br/>/api/billing/cancel<br/>/api/webhooks/payouts/entitlement<br/>/api/cron/sync-tiers<br/>/api/auth/token"]
        AD1[("D1: users.tier<br/>billing_events<br/>app_usage_monthly")]
        AKV[("KV: sessions<br/>MFA challenges")]
        AAPI --> AD1
        AAPI --> AKV
    end

    subgraph PAYOUTS ["payouts.elixpo.com (Cloudflare Pages)"]
        PAPI["v1 API:<br/>POST /v1/checkout/sessions<br/>POST /v1/subscriptions/cancel<br/>POST /v1/sync"]
        PCHECKOUT["Hosted checkout<br/>/checkout?session=..."]
        PWEBHOOK["Inbound: /api/webhooks/razorpay"]
        POUTBOUND["Outbound webhook dispatcher<br/>fires entitlement.updated"]
        PD1[("D1: products prices<br/>subscriptions<br/>entitlements")]
        PAPI --> PD1
        PWEBHOOK --> PD1
        POUTBOUND --> PD1
    end

    subgraph MAILS ["mails.elixpo.com"]
        MAILSAPI["Per-template hook endpoints"]
    end

    subgraph RAZORPAY ["Razorpay (external)"]
        RZP["Plans + Subscriptions APIs<br/>Hosted mandate UX (rzp.io)"]
    end

    %% User flows — start a subscription
    U -- "1. Click Indie on /pricing" --> AUI
    AUI -- "2. POST /api/billing/checkout<br/>cookie: access_token" --> AAPI
    AAPI -- "3. POST /v1/checkout/sessions<br/>Bearer ELIXPO_ACCOUNTS_PAYOUT_CLIENT_SECRET" --> PAPI
    PAPI -- "4. createSubscription(plan_id)" --> RZP
    RZP -- "5. {short_url}" --> PAPI
    PAPI -- "6. {url: payouts/checkout?session=...}" --> AAPI
    AAPI -- "7. redirect" --> AUI
    AUI -- "8. browser to /checkout" --> PCHECKOUT
    PCHECKOUT -- "9. POST /api/checkout/session" --> PAPI
    PAPI -- "10. {short_url, billing_mode: autopay}" --> PCHECKOUT
    PCHECKOUT -- "11. window.location = short_url" --> RZP

    %% Mandate + first charge
    RZP -- "12. User accepts mandate" --> RZP
    RZP -- "13. subscription.activated<br/>+ subscription.charged" --> PWEBHOOK
    PWEBHOOK -- "14. fulfillPayment<br/>extends entitlement" --> POUTBOUND

    %% Outbound webhook to accounts
    POUTBOUND -- "15. POST /api/webhooks/payouts/entitlement<br/>X-Elixpo-Pay-Signature: sha256=...<br/>HMAC(secret: PAYOUTS_WEBHOOK_SECRET)" --> AAPI
    AAPI -- "16. users.tier = 'indie'<br/>tier_renews_at = ..." --> AD1
    AAPI -- "17. sendMail(billing_subscription_activated)<br/>X-Elixpo-Signature: t=...,v1=...<br/>HMAC(secret: MAILS_SHARED_SECRET)" --> MAILSAPI
    MAILSAPI -- "18. delivers email" --> U

    %% Cancel flow
    U -- "C1. Click Cancel on /dashboard/subscriptions" --> AUI
    AUI -- "C2. POST /api/billing/cancel" --> AAPI
    AAPI -- "C3. POST /v1/subscriptions/cancel<br/>Bearer ELIXPO_ACCOUNTS_PAYOUT_CLIENT_SECRET" --> PAPI
    PAPI -- "C4. cancelSubscription(cancel_at_cycle_end=true)" --> RZP
    RZP -- "C5. subscription.cancelled" --> PWEBHOOK
    PWEBHOOK -- "C6. entitlement.updated<br/>active:true, status:cancelled" --> POUTBOUND
    POUTBOUND --> AAPI
    AAPI -- "C7. sendMail(billing_subscription_cancelled)" --> MAILSAPI

    %% Catalog sync from GitHub Actions
    GH[("GitHub Actions<br/>daily cron")] -- "S1. POST /api/cron/sync-tiers<br/>Bearer ELIXPO_ACCOUNTS_PAYOUT_CLIENT_SECRET" --> AAPI
    AAPI -- "S2. POST /v1/sync<br/>same Bearer key" --> PAPI
    PAPI -- "S3. lazy-creates Plan if needed" --> RZP

    %% MAU counter
    U -- "OAuth flow: /api/auth/token" --> AAPI
    AAPI -- "recordMauHit(client_id, user_id)" --> AD1

    classDef external fill:#ff6b6b,stroke:#c92a2a,color:#fff
    classDef account fill:#9b7bf7,stroke:#7c5cff,color:#fff
    classDef payment fill:#fbbf24,stroke:#d97706,color:#000
    classDef mail fill:#5fb6ff,stroke:#0c8ce9,color:#fff
    class RZP external
    class AUI,AAPI,AD1,AKV account
    class PAPI,PCHECKOUT,PWEBHOOK,POUTBOUND,PD1 payment
    class MAILSAPI mail
```

### Secrets and where they live

| Secret | Set on | What it authenticates |
|---|---|---|
| `ELIXPO_ACCOUNTS_PAYOUT_CLIENT_SECRET` (`lix_pay_…`) | accounts CF env + GitHub repo secrets | accounts → payouts `/v1/*` Bearer; also gates inbound `/api/cron/sync-tiers` from the GH workflow |
| `PAYOUTS_WEBHOOK_SECRET` (`whsec_…`) | accounts CF env | Inbound `entitlement.updated` from payouts — verified by HMAC-SHA256 on `X-Elixpo-Pay-Signature` |
| `MAILS_SHARED_SECRET` | accounts CF env | Outbound calls to mails.elixpo — HMAC-SHA256 on `X-Elixpo-Signature: t=…,v1=…` over `${t}.${rawBody}` |
| `MAILS_HOOK_*` (12 keys) | accounts CF env | Per-template endpoint id on mails.elixpo (one per template: `user_verify_otp`, `billing_subscription_activated`, etc.) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | **payouts only** | Razorpay HTTP Basic auth + webhook signature |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` (EdDSA PEM) | accounts CF env | Signing access + refresh tokens (cookie `access_token`) |
| `MFA_JWT_SECRET` | accounts CF env | Short-lived MFA challenge tokens |
| `TRUSTED_DEVICE_SECRET` | accounts CF env | 30-day trusted-device cookie JWT |

---

## Want to help build it?

This is open source. Pull requests are welcome.

If you want to run it on your machine or send a change, here's the short version:

```bash
git clone https://github.com/elixpo/accounts.elixpo.git
cd accounts.elixpo
npm install
cp .env.example .env.local       # fill in the blanks
npm run db:migrate:local         # set up the local database
npm run dev                      # open http://localhost:3000
```

For the full developer manual — architecture, conventions, what to do and what to avoid — read **[AGENTS.md](AGENTS.md)**.

---

## Found a bug? Have an idea?

Open an issue → **[github.com/elixpo/accounts.elixpo/issues](https://github.com/elixpo/accounts.elixpo/issues)**.

For security issues, please email us privately instead of opening a public issue.

---

<div align="center">

Made with care by the **[Elixpo](https://github.com/elixpo) Open Source Team**.

</div>

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=120&section=footer&reversal=false" width="100%" alt="wave footer"/>
