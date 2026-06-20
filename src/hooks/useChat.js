import { useState, useCallback } from 'react'

export function useChat(user, onAuthExpired) {
  const [conversations, setConversations] = useState({})
  const [currentAgentId, setCurrentAgentId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  function switchAgent(id) { setCurrentAgentId(id) }

  function newChat() {
    if (!currentAgentId) return
    setConversations(prev => ({ ...prev, [currentAgentId]: [] }))
  }

  const sendMessage = useCallback(async (text, attachedFiles = []) => {
    if (!text.trim() || isLoading || !user || !currentAgentId) return

    const userMsg = { role: 'user', content: text }
    setConversations(prev => ({
      ...prev,
      [currentAgentId]: [...(prev[currentAgentId] || []), userMsg],
    }))
    setIsLoading(true)

    try {
      const history = conversations[currentAgentId] || []

      const payload = {
        history,
        userText: text,
        agentId: currentAgentId,
        email: user.email,
        sessionToken: user.sessionToken,
        sessionExpiry: user.sessionExpiry,
      }

      if (attachedFiles.length > 0) {
        payload.files = attachedFiles.map(f => ({
          name: f.name,
          mimeType: f.mimeType,
          category: f.category,
          data: f.data,
        }))
      }

      const res = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const ct = res.headers.get('content-type') || ''
      const data = ct.includes('application/json') ? await res.json() : {}

      if (res.status === 401) { onAuthExpired?.(); return }
      if (!res.ok) {
        if (res.status === 502 || res.status === 504 || res.status === 524) {
          throw new Error('The server took too long to respond. Please try again.')
        }
        throw new Error(data.error || `Something went wrong (${res.status}). Please try again.`)
      }

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
