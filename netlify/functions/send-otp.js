const crypto = require('crypto');

// In-memory OTP store (for serverless — resets between function cold starts)
// For production, replace with a KV store like Netlify Blobs or Upstash Redis
const OTP_STORE = {};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const headers = { 'Content-Type': 'application/json' };

  try {
    const { email } = JSON.parse(event.body);
    if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP (keyed by email)
    OTP_STORE[email.toLowerCase()] = { otp, expires };

    // Send via SendGrid
    const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: {
          email: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
          name: 'DVM Advisory'
        },
        subject: 'Your DVM login code',
        content: [{
          type: 'text/html',
          value: `
            <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
              <div style="font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#8a8a8a;margin-bottom:24px;">DVM Advisory Workspace</div>
              <h1 style="font-family:Georgia,serif;font-size:24px;color:#1a1a1a;margin:0 0 8px;">Your login code</h1>
              <p style="font-size:15px;color:#4a4a4a;margin:0 0 28px;line-height:1.6;">Use the code below to sign in. It expires in 10 minutes.</p>
              <div style="background:#f2f2ef;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;">
                <span style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:12px;color:#1a3a5c;">${otp}</span>
              </div>
              <p style="font-size:13px;color:#8a8a8a;line-height:1.6;">If you did not request this, you can safely ignore this email.</p>
            </div>
          `
        }]
      })
    });

    if (!sgRes.ok) {
      const err = await sgRes.text();
      throw new Error('Email send failed: ' + err);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('Send OTP error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

// Export store so verify function can access it (same module scope within same function instance)
module.exports.OTP_STORE = OTP_STORE;
