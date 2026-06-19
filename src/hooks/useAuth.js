import { useState, useEffect, useRef } from 'react'

const SESSION_KEY = 'dvm_session'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [step, setStep] = useState('email')
  const [pendingEmail, setPendingEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const otpRef = useRef(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed.sessionExpiry && Math.floor(Date.now() / 1000) < parsed.sessionExpiry) {
        setUser(parsed)
      } else {
        sessionStorage.removeItem(SESSION_KEY)
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }, [])

  async function sendOtp(email) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/.netlify/functions/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send code')
      otpRef.current = { token: data.token, expiry: data.expiry }
      setPendingEmail(email)
      setStep('otp')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp(code) {
    setLoading(true)
    setError('')
    try {
      const { token, expiry } = otpRef.current || {}
      const res = await fetch('/.netlify/functions/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code, token, expiry }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid code')
      // isAdmin is NOT stored in sessionStorage — it's verified server-side on every admin operation
      const session = {
        email: data.email,
        sessionToken: data.sessionToken,
        sessionExpiry: data.sessionExpiry,
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
      // isAdmin lives in memory only — tamper-proof across page loads via backend verification
      session.isAdmin = data.isAdmin
      otpRef.current = null
      setUser(session)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    otpRef.current = null
    setUser(null)
    setStep('email')
    setPendingEmail('')
    setError('')
  }

  function backToEmail() {
    setStep('email')
    setError('')
    otpRef.current = null
  }

  return { user, step, pendingEmail, error, loading, sendOtp, verifyOtp, logout, backToEmail }
}
