import React, { useState, useRef } from 'react'
import './Auth.css'

export default function OTPForm({ auth }) {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const refs = useRef([])
  const code = digits.join('')

  function handleChange(i, val) {
    if (!/^[0-9]?$/.test(val)) return
    const next = [...digits]
    next[i] = val
    setDigits(next)
    if (val && i < 5) refs.current[i + 1]?.focus()
  }

  function handleKeyDown(e, i) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
    if (e.key === 'Enter' && code.length === 6) auth.verifyOtp(code)
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = Array.from({ length: 6 }, (_, i) => pasted[i] || '')
    setDigits(next)
    refs.current[Math.min(pasted.length, 5)]?.focus()
  }

  return (
    <div className="auth-card">
      <div className="auth-logo">DVM</div>
      <h1>Check your inbox</h1>
      <p className="otp-hint">
        We sent a 6-digit code to <strong>{auth.pendingEmail}</strong>.
        It expires in 10 minutes.
      </p>
      <div className="otp-inputs" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => refs.current[i] = el}
            className="otp-box"
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(e, i)}
            autoFocus={i === 0}
          />
        ))}
      </div>
      {auth.error && <div className="auth-error">{auth.error}</div>}
      <button
        className="auth-btn"
        onClick={() => auth.verifyOtp(code)}
        disabled={auth.loading || code.length < 6}
      >
        {auth.loading ? 'Verifying…' : 'Verify & sign in'}
      </button>
      <button className="auth-back-link" onClick={auth.backToEmail}>
        ← Back to email
      </button>
    </div>
  )
}
