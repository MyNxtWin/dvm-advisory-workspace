# DVM Advisory Workspace — Setup Guide

A private AI workspace with two agents (DVM Compliance + Board Governance), email OTP login, and multi-domain access control. Hosted entirely on Netlify — no servers needed.

---

## What's included

- `index.html` — the full frontend application
- `netlify/functions/chat.js` — calls the Anthropic API with the agent's system prompt
- `netlify/functions/send-otp.js` — sends a 6-digit OTP via SendGrid
- `netlify/functions/verify-otp.js` — verifies the OTP and signs the user in
- `netlify.toml` — Netlify build and security configuration

---

## Step 1 — Configure your allowed domains

Open `index.html` and find this line near the top of the `<script>` section:

```js
const ALLOWED_DOMAINS = ['yourdomain.com', 'yourfirm2.com'];
```

Replace with your actual company email domains. Only users with these domains can log in.

---

## Step 2 — Get your API keys

You need two:

**Anthropic API key**
- Go to console.anthropic.com → API Keys → Create key
- Keep this private — never paste it in the frontend code

**SendGrid API key** (for sending OTP emails)
- Go to sendgrid.com → Settings → API Keys → Create key
- Choose "Restricted Access" → Mail Send → Full Access
- Also verify your sender email address in SendGrid (Settings → Sender Authentication)

---

## Step 3 — Deploy to Netlify

1. Create a new repository on GitHub and push this entire folder to it
2. Go to netlify.com → Add new site → Import from GitHub → select your repo
3. Build settings are auto-detected from `netlify.toml` — no changes needed
4. Click **Deploy site**

---

## Step 4 — Add environment variables in Netlify

Go to your Netlify site → **Site configuration → Environment variables → Add variable**

Add these three:

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `SENDGRID_API_KEY` | Your SendGrid API key |
| `FROM_EMAIL` | The verified sender email (e.g. dvm@yourfirm.com) |

After adding, go to **Deploys → Trigger deploy** so the variables take effect.

---

## Step 5 — Test

1. Open your Netlify URL (e.g. `https://dvm-advisory.netlify.app`)
2. Enter your work email → receive OTP → sign in
3. Try both agents — ask a compliance question to DVM, and ask Board Governance to draft an agenda

---

## Adding more agents later

Open `index.html` and find the `AGENTS` object. Copy the structure of an existing agent, give it a new key, and add a button in the sidebar HTML. The system prompt lives entirely in that object — no backend changes needed.

---

## Production upgrade — persistent OTP store

The default OTP store uses Node.js global memory, which works for small teams but can lose codes if Netlify spins up multiple function instances simultaneously.

For a more robust setup, replace the in-memory store with **Upstash Redis** (free tier available):

1. Create a free Redis database at upstash.com
2. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Netlify environment variables
3. In both OTP functions, replace the `OTP_STORE` object with Redis SET/GET/DEL calls using the Upstash REST API

This is a one-hour upgrade and makes the login bullet-proof at any scale.

---

## Security notes

- Your Anthropic API key never touches the browser — it lives only in Netlify's environment
- OTP codes expire in 10 minutes and are deleted after one use
- Domain restriction is enforced on both frontend and backend
- All traffic is HTTPS — enforced by Netlify

---

## Cost estimate (small team of 10-20 users)

| Service | Cost |
|---|---|
| Netlify hosting + functions | Free tier (125k function calls/month) |
| Anthropic API | ~$5–15/month depending on usage |
| SendGrid | Free tier (100 emails/day) |
| **Total** | **~$5–15/month** |
