<div align="center">
  <img src="https://github.com/user-attachments/assets/a2057d99-fc2d-4e19-ab16-661a403bc0ec" alt="Elixpo Accounts Banner" width="600"/>

  <h1>🔐 Elixpo Accounts</h1>

  <p><em>One account. Every Elixpo tool. Zero friction.</em></p>

  <p>
    <a href="https://accounts.elixpo.com"><img src="https://img.shields.io/badge/live-accounts.elixpo.com-a3e635?style=flat-square" alt="Live"/></a>
    <img src="https://img.shields.io/badge/status-active-22c55e?style=flat-square" alt="Active"/>
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT"/>
    <img src="https://img.shields.io/badge/runs%20on-Cloudflare-f38020?style=flat-square" alt="Cloudflare"/>
  </p>
</div>

---

## 🌟 What is this?

**Elixpo Accounts** is the front door to everything Elixpo. Instead of creating a new username and password for every tool in our ecosystem — chat, search, blogs, art, you name it — you sign up once here and get access to all of them.

Think of it as your universal Elixpo passport.

---

## ✨ Why you'll like it

| | |
|---|---|
| 🎫 **One account, everywhere** | Sign up once, use every Elixpo tool. No duplicate profiles. |
| 🔑 **Login your way** | Email + password, Google, or GitHub. Your choice. |
| 📊 **Your own dashboard** | Manage your profile and connected apps all in one place. |
| 🛡️ **Built for privacy** | We only store what's needed. No tracking, no selling data. |
| ⚡ **Instant everywhere** | Runs on Cloudflare's edge network, so it's fast wherever you are. |
| 🧑‍💻 **For developers too** | Build your own app on top of Elixpo's identity — full OAuth 2.0 support. |

---

## 🚀 Get started

### As a user
Head over to **[accounts.elixpo.com](https://accounts.elixpo.com)** and sign up. That's it. The next time you open any Elixpo tool, you'll be signed in automatically.

### As a developer
Want to let people log into *your* app using their Elixpo account? You can.

1. Go to your [Developer Dashboard](https://accounts.elixpo.com/dashboard/oauth-apps)
2. Register your application and grab the credentials
3. Plug them into your app — we speak standard OAuth 2.0, so any library works
4. Your users now get one-click login with their Elixpo account

Full integration guide lives in [`CLAUDE.md`](./CLAUDE.md).

---

## 🧰 What's under the hood

For the curious:

<table>
  <tr>
    <td>🎨 <b>Frontend</b></td>
    <td>Next.js 15 · React 19 · Tailwind CSS</td>
  </tr>
  <tr>
    <td>☁️ <b>Hosting</b></td>
    <td>Cloudflare Pages (runs at the edge, globally)</td>
  </tr>
  <tr>
    <td>💾 <b>Database</b></td>
    <td>Cloudflare D1 (fast, serverless SQLite)</td>
  </tr>
  <tr>
    <td>🔐 <b>Auth</b></td>
    <td>JWT tokens in secure cookies · Web Crypto API</td>
  </tr>
  <tr>
    <td>📧 <b>Email</b></td>
    <td>Cloudflare Workers SMTP</td>
  </tr>
</table>

---

## 🤝 Contributing

We love pull requests. Whether it's fixing a typo, reporting a bug, or building a new feature — you're welcome here.

- Found a bug? [Open an issue](https://github.com/elixpo/accounts.elixpo/issues/new)
- Want to help out? Browse our [open issues](https://github.com/elixpo/accounts.elixpo/issues) and pick one that catches your eye
- Have an idea? Tag it `FEATURE` and we'll chat


---

## 📜 License

MIT — see [LICENSE](./LICENSE). Use it, fork it, build on it.

---

<div align="center">
  <sub>
    Built with care by the <b>Elixpo</b> team<br/>
    <a href="https://elixpo.com">elixpo.com</a> · <a href="https://github.com/elixpo">GitHub</a>
  </sub>
</div>
