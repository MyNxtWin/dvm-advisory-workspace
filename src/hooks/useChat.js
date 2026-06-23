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

      // Step 1: submit to chat-start — validates and returns a jobId immediately
      const startRes = await fetch('/.netlify/functions/chat-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const startCt = startRes.headers.get('content-type') || ''
      const startData = startCt.includes('application/json') ? await startRes.json() : {}

      if (startRes.status === 401) { onAuthExpired?.(); return }
      if (!startRes.ok) {
        throw new Error(startData.error || `Something went wrong (${startRes.status}). Please try again.`)
      }

      const { jobId } = startData
      const capturedAgentId = currentAgentId

      // Step 2: poll chat-poll until the background function finishes (max 90 s)
      const deadline = Date.now() + 90_000
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2500))

        const pollRes = await fetch(`/.netlify/functions/chat-poll?jobId=${jobId}`)
        const pollData = await pollRes.json()

        if (pollData.status === 'done') {
          setConversations(prev => ({
            ...prev,
            [capturedAgentId]: [...(prev[capturedAgentId] || []), { role: 'assistant', content: pollData.response }],
          }))
          return
        }

        if (pollData.status === 'error') {
          throw new Error(pollData.error || 'Something went wrong. Please try again.')
        }
      }

      throw new Error('The server took too long to respond. Please try again.')
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
