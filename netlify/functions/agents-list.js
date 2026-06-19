const fs = require('fs')
const path = require('path')
const { verifySession, corsHeaders } = require('./_auth')

function loadAgents() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../../data/agents.json'), 'utf8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

exports.handler = async (event) => {
  const cors = corsHeaders(event)
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }

  const headers = { ...cors, 'Content-Type': 'application/json' }

  try {
    const { email, sessionToken, sessionExpiry } = JSON.parse(event.body || '{}')
    if (!verifySession(email, sessionToken, sessionExpiry)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Session expired. Please sign in again.' }) }
    }

    const agents = loadAgents()
      .map(a => ({ id: a.id, name: a.name, shortName: a.shortName, desc: a.desc, icon: a.icon, order: a.order ?? 99, chips: a.chips || [] }))

    return { statusCode: 200, headers, body: JSON.stringify({ agents }) }
  } catch (err) {
    console.error('agents-list:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to load agents.' }) }
  }
}
