# DVM Advisory Workspace

A private AI workspace for MyNxtWin — email OTP login, per-domain access control, admin panel to create and manage agents, deployed entirely on Netlify (no external database needed).

---

## Architecture at a glance

```
Browser (React + Vite)
    │
    ├── /.netlify/functions/send-otp      — rate-limited, domain-checked OTP via Resend
    ├── /.netlify/functions/verify-otp    — HMAC verify → issues 8-hour session token
    ├── /.netlify/functions/agents-list   — session-gated, returns agent metadata (no system prompts)
    ├── /.netlify/functions/agents-manage — admin-only CRUD, stores agents in Netlify Blobs
    └── /.netlify/functions/chat          — session-gated, loads system prompt from Blobs, calls Anthropic
```

Agent data (including system prompts) lives entirely in **Netlify Blobs** — no GitHub token, no external DB, no CMS needed. The admin panel is the CMS.

---

## Step 1 — Get your API keys

**Anthropic** — `console.anthropic.com` → API Keys → Create key

**Resend** (free OTP email, 3,000/month) — `resend.com` → API Keys → Create key
- Also add and verify your sending domain in Resend → Domains

---

## Step 2 — Create `.env`

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

```
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
FROM_EMAIL=DVM Advisory <noreply@yourdomain.com>
OTP_SECRET=                  # openssl rand -hex 32
ALLOWED_DOMAINS=mynxtwin.com
ADMIN_EMAILS=technology@mynxtwin.com
SITE_URL=                    # blank locally, set in Netlify for production
```

Never commit `.env` to git — it's in `.gitignore`.

---

## Step 3 — Deploy to Netlify

1. Push this repo to GitHub
2. `netlify.com` → Add new site → Import from GitHub → select the repo
3. Build settings are auto-detected from `netlify.toml`
4. Go to **Site configuration → Environment variables** and add all seven vars from above
5. **Deploys → Trigger deploy**

---

## Step 4 — Add agents via the admin panel

Once deployed:
1. Log in with an email listed in `ADMIN_EMAILS`
2. Go to `/admin`
3. Click **New Agent** → fill in the form (id, name, system prompt, chips, etc.)
4. Save — the agent appears in the workspace immediately

No redeployment needed. Agents are stored in Netlify Blobs and loaded at runtime.

---

## Environment variables reference

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key — never touches the browser |
| `RESEND_API_KEY` | Resend key for OTP email delivery |
| `FROM_EMAIL` | Sender shown in OTP email — must be a verified Resend domain |
| `OTP_SECRET` | HMAC signing key for OTP + session tokens — generate with `openssl rand -hex 32` |
| `ALLOWED_DOMAINS` | Comma-separated domains allowed to log in, e.g. `mynxtwin.com` |
| `ADMIN_EMAILS` | Comma-separated emails with admin panel access |
| `SITE_URL` | Your Netlify URL — locks CORS to your domain. Leave blank locally. |

---

## Security notes

- OTP tokens are HMAC-signed server-side — never stored anywhere, expire in 10 minutes
- Session tokens are HMAC-signed, 8-hour expiry, verified on every backend call
- Admin status is verified server-side on every admin operation — cannot be faked from the browser
- System prompts never leave the server — only metadata is sent to the frontend
- CORS is locked to `SITE_URL` in production
