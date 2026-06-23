const crypto = require('crypto')
const { signOtp, getAllowedDomains, corsHeaders } = require('./_auth')

// In-memory rate limit — 3 OTP requests per email per 15 minutes
const RATE_STORE = {}

function checkRate(email) {
  const now = Date.now()
  const window = 15 * 60 * 1000
  const key = email.toLowerCase()
  RATE_STORE[key] = (RATE_STORE[key] || []).filter(t => now - t < window)
  if (RATE_STORE[key].length >= 3) return false
  RATE_STORE[key].push(now)
  return true
}

// RFC 5321: max 254 chars; basic structure check
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{1,63}$/

exports.handler = async (event) => {
  const cors = corsHeaders(event)
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) }

  const headers = { ...cors, 'Content-Type': 'application/json' }

  try {
    const { email } = JSON.parse(event.body || '{}')

    if (!email || typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required.' }) }
    }

    const domain = email.split('@')[1].toLowerCase()
    const allowed = getAllowedDomains()
    if (allowed.length > 0 && !allowed.includes(domain)) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Access restricted to authorised email domains.' }) }
    }

    if (!checkRate(email)) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests. Wait 15 minutes before trying again.' }) }
    }

    const otp = crypto.randomInt(100000, 999999).toString()
    const expiry = Math.floor(Date.now() / 1000) + 600
    const token = signOtp(email, otp, expiry)

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'DVM Advisory <noreply@yourdomain.com>',
        to: [email],
        subject: 'Your DVM login code',
        html: `<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;"><p style="font-size:13px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#8a8a8a;margin-bottom:24px;">DVM Advisory Workspace</p><h1 style="font-family:Georgia,serif;font-size:24px;color:#1a1a1a;margin:0 0 8px;">Your login code</h1><p style="font-size:15px;color:#4a4a4a;margin:0 0 28px;line-height:1.6;">Expires in 10 minutes. Do not share this code.</p><div style="background:#f2f2ef;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;"><span style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:12px;color:#1a3a5c;">${otp}</span></div><p style="font-size:13px;color:#8a8a8a;">If you didn't request this, ignore this email.</p></div>`,
      }),
    })

    if (!emailRes.ok) {
      const errBody = await emailRes.json().catch(() => ({}))
      console.error('send-otp Resend error:', emailRes.status, JSON.stringify(errBody))
      throw new Error('Email delivery failed')
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, token, expiry }) }
  } catch (err) {
    console.error('send-otp:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to send code. Please try again.' }) }
  }
}
