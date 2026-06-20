const { verifyOtpToken, signSession, isAdmin, corsHeaders } = require('./_auth')

// Rate limit OTP verification — max 5 attempts per email per 10 minutes
// Prevents brute-forcing the 6-digit code using the HMAC token
const ATTEMPT_STORE = {}

function checkAttempts(email) {
  const now = Date.now()
  const window = 10 * 60 * 1000
  const key = email.toLowerCase()
  ATTEMPT_STORE[key] = (ATTEMPT_STORE[key] || []).filter(t => now - t < window)
  if (ATTEMPT_STORE[key].length >= 5) return false
  ATTEMPT_STORE[key].push(now)
  return true
}

function clearAttempts(email) {
  delete ATTEMPT_STORE[email.toLowerCase()]
}

exports.handler = async (event) => {
  const cors = corsHeaders(event)
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) }

  const headers = { ...cors, 'Content-Type': 'application/json' }

  try {
    const { email, code, token, expiry } = JSON.parse(event.body || '{}')

    if (!email || !code || !token || !expiry) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields.' }) }
    }

    if (!checkAttempts(email)) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many attempts. Request a new code.' }) }
    }

    if (!verifyOtpToken(email, code, token, expiry)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Incorrect or expired code. Please try again.' }) }
    }

    clearAttempts(email)

    const sessionExpiry = Math.floor(Date.now() / 1000) + 7 * 24 * 3600
    const sessionToken = signSession(email, sessionExpiry)

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, email, sessionToken, sessionExpiry, isAdmin: isAdmin(email) }),
    }
  } catch (err) {
    console.error('verify-otp:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Verification failed. Please try again.' }) }
  }
}
