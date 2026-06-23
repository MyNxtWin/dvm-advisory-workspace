import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'chat_pending'

function saveChat(agentId, history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ agentId, history }))
  } catch {}
}

function clearChat() {
  localStorage.removeItem(STORAGE_KEY)
}

export function useChat(user, onAuthExpired) {
  const [conversations, setConversations] = useState({})
  const [currentAgentId, setCurrentAgentId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  function switchAgent(id) {
    if (id === currentAgentId) return
    setCurrentAgentId(id)
    clearChat()
  }

  function newChat() {
    if (!currentAgentId) return
    setConversations(prev => ({ ...prev, [currentAgentId]: [] }))
    clearChat()
  }

  // On mount: restore the last saved chat conversation.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    try {
      const { agentId, history } = JSON.parse(saved)
      if (!agentId || !Array.isArray(history)) throw new Error('invalid')
      setCurrentAgentId(agentId)
      setConversations(prev => ({ ...prev, [agentId]: history }))
    } catch {
      clearChat()
    }
  }, [])

  const startPolling = useCallback(async (jobId, capturedAgentId, historySnapshot) => {
    try {
      while (true) {
        await new Promise(r => setTimeout(r, 2500))

        const pollRes = await fetch(`/.netlify/functions/chat-poll?jobId=${jobId}`)
        const pollData = await pollRes.json()

        if (pollData.status === 'done') {
          const assistantMsg = { role: 'assistant', content: pollData.response }
          setConversations(prev => ({
            ...prev,
            [capturedAgentId]: [...(prev[capturedAgentId] || []), assistantMsg],
          }))
          saveChat(capturedAgentId, [...historySnapshot, assistantMsg])
          return
        }

        if (pollData.status === 'error') {
          throw new Error(pollData.error || 'Something went wrong. Please try again.')
        }
      }
    } catch (e) {
      const errorMsg = { role: 'assistant', content: '⚠ ' + e.message }
      setConversations(prev => ({
        ...prev,
        [capturedAgentId]: [...(prev[capturedAgentId] || []), errorMsg],
      }))
      saveChat(capturedAgentId, [...historySnapshot, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const sendMessage = useCallback(async (text, attachedFiles = []) => {
    if (!text.trim() || isLoading || !user || !currentAgentId) return

    const userMsg = { role: 'user', content: text }
    const capturedAgentId = currentAgentId
    const history = conversations[capturedAgentId] || []
    const historyWithUser = [...history, userMsg]

    setConversations(prev => ({ ...prev, [capturedAgentId]: historyWithUser }))
    setIsLoading(true)
    saveChat(capturedAgentId, historyWithUser)

    try {
      const payload = {
        history,
        userText: text,
        agentId: capturedAgentId,
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

      const startRes = await fetch('/.netlify/functions/chat-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const startCt = startRes.headers.get('content-type') || ''
      const startData = startCt.includes('application/json') ? await startRes.json() : {}

      if (startRes.status === 401) { setIsLoading(false); onAuthExpired?.(); return }
      if (!startRes.ok) {
        throw new Error(startData.error || `Something went wrong (${startRes.status}). Please try again.`)
      }

      const { jobId } = startData
      await startPolling(jobId, capturedAgentId, historyWithUser)
    } catch (e) {
      const errorMsg = { role: 'assistant', content: '⚠ ' + e.message }
      setConversations(prev => ({
        ...prev,
        [capturedAgentId]: [...(prev[capturedAgentId] || []), errorMsg],
      }))
      saveChat(capturedAgentId, [...historyWithUser, errorMsg])
      setIsLoading(false)
    }
  }, [currentAgentId, conversations, isLoading, user, onAuthExpired, startPolling])

  const messages = currentAgentId ? (conversations[currentAgentId] || []) : []

  return { messages, currentAgentId, isLoading, switchAgent, newChat, sendMessage }
}
