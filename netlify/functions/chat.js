const fs = require('fs')
const path = require('path')
const { verifySession, corsHeaders } = require('./_auth')

// Per-user chat rate limit — 30 messages per 5 minutes
const CHAT_RATE = {}

function checkChatRate(email) {
  const now = Date.now()
  const window = 5 * 60 * 1000
  const key = email.toLowerCase()
  CHAT_RATE[key] = (CHAT_RATE[key] || []).filter(t => now - t < window)
  if (CHAT_RATE[key].length >= 30) return false
  CHAT_RATE[key].push(now)
  return true
}

const VALID_CATEGORIES = new Set(['image', 'document', 'text'])
const MAX_FILES = 5
const MAX_FILE_DATA = 13_631_488 // ~13 MB base64 (covers 10 MB binary with encoding overhead)
const MAX_USER_TEXT = 32_000
const VALID_MODEL = /^claude-[\w.-]+$/

function getAgent(agentId) {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../../data/agents.json'), 'utf8')
    return JSON.parse(raw).find(a => a.id === agentId) || null
  } catch { return null }
}

function safeModel(model) {
  return (model && VALID_MODEL.test(model)) ? model : 'claude-haiku-4-5-20251001'
}

function buildContent(files, userText) {
  if (!files || files.length === 0) return userText
  const blocks = []
  for (const f of files) {
    const safeName = (f.name || 'file').replace(/[<>"&]/g, '').slice(0, 200)
    if (f.category === 'image') {
      blocks.push({ type: 'image', source: { type: 'base64', media_type: f.mimeType, data: f.data } })
    } else if (f.category === 'document') {
      blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } })
    } else {
      blocks.push({ type: 'text', text: `<file name="${safeName}">\n${f.data}\n</file>` })
    }
  }
  blocks.push({ type: 'text', text: userText })
  return blocks
}

exports.handler = async (event) => {
  const cors = corsHeaders(event)
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) }

  const headers = { ...cors, 'Content-Type': 'application/json' }

  try {
    const { history, userText, files, agentId, email, sessionToken, sessionExpiry } = JSON.parse(event.body || '{}')

    if (!verifySession(email, sessionToken, sessionExpiry)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Session expired. Please sign in again.' }) }
    }

    if (!checkChatRate(email)) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many messages. Wait a few minutes.' }) }
    }

    if (!agentId || !userText?.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing agentId or message.' }) }
    }

    if (userText.length > MAX_USER_TEXT) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message too long.' }) }
    }

    // Validate files
    if (files !== undefined) {
      if (!Array.isArray(files) || files.length > MAX_FILES) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Too many files attached.' }) }
      }
      for (const f of files) {
        if (!VALID_CATEGORIES.has(f.category) || typeof f.data !== 'string' || f.data.length > MAX_FILE_DATA) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid file data.' }) }
        }
      }
    }

    const agent = getAgent(agentId)
    if (!agent?.systemPrompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown agent.' }) }
    }

    const validHistory = Array.isArray(history)
      ? history.filter(m => m.role && m.content).slice(-20).map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: typeof m.content === 'string' ? m.content.slice(0, 8000) : m.content,
        }))
      : []

    const currentContent = buildContent(files, userText.trim())
    const allMessages = [...validHistory, { role: 'user', content: currentContent }]

    const hasPDF = files?.some(f => f.category === 'document')
    const reqHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      ...(hasPDF && { 'anthropic-beta': 'pdfs-2024-09-25' }),
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify({
        model: safeModel(agent.model),
        max_tokens: 4096,
        cache_control: { type: 'ephemeral' },
        system: [{ type: 'text', text: agent.systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: allMessages,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'API error')

    const text = data.content?.[0]?.text || ''
    return { statusCode: 200, headers, body: JSON.stringify({ response: text }) }
  } catch (err) {
    console.error('chat:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to get response. Please try again.' }) }
  }
}
