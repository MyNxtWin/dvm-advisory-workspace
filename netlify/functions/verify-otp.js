// NOTE: In serverless environments, each function invocation may run in a fresh context.
// For production reliability, use a persistent store (Netlify Blobs, Upstash Redis, or FaunaDB).
// The implementation below works for low-traffic/demo use — see README for production upgrade path.

const crypto = require('crypto');

// Shared in-memory store — works within the same warm Lambda instance
// Replace with external KV store for production (see README)
const OTP_STORE = global.__DVM_OTP_STORE || (global.__DVM_OTP_STORE = {});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const headers = { 'Content-Type': 'application/json' };

  try {
    const { email, code } = JSON.parse(event.body);
    if (!email || !code) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email and code required' }) };
    }

    const key = email.toLowerCase();
    const record = OTP_STORE[key];

    if (!record) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No code found. Please request a new one.' }) };
    }

    if (Date.now() > record.expires) {
      delete OTP_STORE[key];
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Code has expired. Please request a new one.' }) };
    }

    // Timing-safe comparison
    const valid = crypto.timingSafeEqual(
      Buffer.from(record.otp),
      Buffer.from(code.trim())
    );

    if (!valid) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Incorrect code. Please try again.' }) };
    }

    // Valid — clear the OTP
    delete OTP_STORE[key];
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, email }) };

  } catch (err) {
    console.error('Verify OTP error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Verification failed. Please try again.' }) };
  }
};
