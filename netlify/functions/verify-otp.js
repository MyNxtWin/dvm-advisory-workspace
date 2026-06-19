const { verifyOtpToken, signSession, isAdmin, corsHeaders } = require('./_auth')

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

    if (!verifyOtpToken(email, code, token, expiry)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Incorrect or expired code. Please try again.' }) }
    }

    const sessionExpiry = Math.floor(Date.now() / 1000) + 8 * 3600
    const sessionToken = signSession(email, sessionExpiry)
    const admin = isAdmin(email)

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, email, sessionToken, sessionExpiry, isAdmin: admin }),
    }
  } catch (err) {
    console.error('verify-otp:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Verification failed. Please try again.' }) }
  }
}
