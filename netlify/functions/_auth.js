const crypto = require('crypto')

// Fail hard at cold-start if OTP_SECRET is missing — don't let functions boot with a guessable key
if (!process.env.OTP_SECRET) throw new Error('OTP_SECRET env var is not set')

function hmac(data) {
  return crypto.createHmac('sha256', process.env.OTP_SECRET).update(data).digest('hex')
}

function signOtp(email, otp, expiry) {
  return hmac(email.toLowerCase() + ':' + otp + ':' + expiry)
}

function verifyOtpToken(email, code, token, expiry) {
  if (Math.floor(Date.now() / 1000) > expiry) return false
  const expected = signOtp(email, code.trim(), expiry)
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
  } catch { return false }
}

function signSession(email, expiry) {
  return hmac(email.toLowerCase() + ':session:' + expiry)
}

function verifySession(email, sessionToken, sessionExpiry) {
  if (!email || !sessionToken || !sessionExpiry) return false
  if (Math.floor(Date.now() / 1000) > Number(sessionExpiry)) return false
  const expected = signSession(email, sessionExpiry)
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sessionToken))
  } catch { return false }
}

function isAdmin(email) {
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return admins.includes(email.toLowerCase())
}

function getAllowedDomains() {
  return (process.env.ALLOWED_DOMAINS || '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean)
}

function corsHeaders(event) {
  const origin = event.headers.origin || event.headers.Origin || ''
  const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '')
  // Only echo the origin back if it exactly matches SITE_URL — never fall back to wildcard
  const allowOrigin = (siteUrl && origin === siteUrl) ? origin : siteUrl
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  }
}

module.exports = { signOtp, verifyOtpToken, signSession, verifySession, isAdmin, getAllowedDomains, corsHeaders }
