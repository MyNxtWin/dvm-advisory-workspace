import { useState, useCallback } from 'react'

export function useChat(user, onAuthExpired) {
  const [conversations, setConversations] = useState({})
  const [currentAgentId, setCurrentAgentId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  function switchAgent(id) {
    setCurrentAgentId(id)
  }

  function newChat() {
    if (!currentAgentId) return
    setConversations(prev => ({ ...prev, [currentAgentId]: [] }))
  }

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading || !user || !currentAgentId) return

    const userMsg = { role: 'user', content: text }
    setConversations(prev => ({
      ...prev,
      [currentAgentId]: [...(prev[currentAgentId] || []), userMsg],
    }))
    setIsLoading(true)

    try {
      const history = conversations[currentAgentId] || []
      const res = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...history, userMsg],
          agentId: currentAgentId,
          email: user.email,
          sessionToken: user.sessionToken,
          sessionExpiry: user.sessionExpiry,
        }),
      })

      const data = await res.json()

      if (res.status === 401) {
        onAuthExpired?.()
        return
      }

      if (!res.ok) throw new Error(data.error || 'Request failed')

      setConversations(prev => ({
        ...prev,
        [currentAgentId]: [...(prev[currentAgentId] || []), { role: 'assistant', content: data.response }],
      }))
    } catch (e) {
      setConversations(prev => ({
        ...prev,
        [currentAgentId]: [...(prev[currentAgentId] || []), { role: 'assistant', content: '⚠ ' + e.message }],
      }))
    } finally {
      setIsLoading(false)
    }
  }, [currentAgentId, conversations, isLoading, user, onAuthExpired])

  const messages = currentAgentId ? (conversations[currentAgentId] || []) : []

  return { messages, currentAgentId, isLoading, switchAgent, newChat, sendMessage }
}
