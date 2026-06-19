import { useState, useEffect } from 'react'

export function useAgents(user) {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch('/.netlify/functions/agents-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, sessionToken: user.sessionToken, sessionExpiry: user.sessionExpiry }),
      })
      const data = await res.json()
      if (res.ok && data.agents?.length) setAgents(data.agents)
    } catch {
      // keep fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.email])

  return { agents, loading, error, reload: load }
}
