const fs = require('fs')
const path = require('path')
const { verifySession, corsHeaders } = require('./_auth')

function getAgent(agentId) {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../../data/agents.json'), 'utf8')
    const agents = JSON.parse(raw)
    return agents.find(a => a.id === agentId) || null
  } catch {
    return null
  }
}

exports.handler = async (event) => {
  const cors = corsHeaders(event)
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) }

  const headers = { ...cors, 'Content-Type': 'application/json' }

  try {
    const { messages, agentId, email, sessionToken, sessionExpiry } = JSON.parse(event.body || '{}')

    if (!verifySession(email, sessionToken, sessionExpiry)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Session expired. Please sign in again.' }) }
    }

    if (!agentId || !messages || !Array.isArray(messages) || messages.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing agentId or messages.' }) }
    }

    const agent = getAgent(agentId)
    if (!agent?.systemPrompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown agent.' }) }
    }

    const validMessages = messages
      .filter(m => m.role && m.content && typeof m.content === 'string')
      .slice(-20)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content.slice(0, 8000) }))

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: agent.systemPrompt,
        messages: validMessages,
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
