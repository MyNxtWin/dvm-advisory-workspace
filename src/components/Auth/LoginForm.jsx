import React, { useState } from 'react'
import './Auth.css'

export default function LoginForm({ auth }) {
  const [email, setEmail] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) return
    auth.sendOtp(trimmed)
  }

  return (
    <div className="auth-card">
      <div className="auth-logo">DVM</div>
      <h1>DVM Advisory</h1>
      <p className="auth-subtitle">
        Sign in with your work email to access the workspace.
      </p>
      <form onSubmit={handleSubmit}>
        <input
          className="auth-input"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoFocus
          autoComplete="email"
        />
        {auth.error && <div className="auth-error">{auth.error}</div>}
        <button className="auth-btn" type="submit" disabled={auth.loading}>
          {auth.loading ? 'Sending…' : 'Send login code'}
        </button>
      </form>
    </div>
  )
}
