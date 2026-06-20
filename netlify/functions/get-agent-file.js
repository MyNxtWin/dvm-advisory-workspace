const fs = require('fs')
const path = require('path')
const { verifySession, corsHeaders } = require('./_auth')

exports.handler = async (event) => {
  const cors = corsHeaders(event)
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) }

  const headers = { ...cors, 'Content-Type': 'application/json' }

  try {
    const { agentId, filename, email, sessionToken, sessionExpiry } = JSON.parse(event.body || '{}')

    if (!verifySession(email, sessionToken, sessionExpiry)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Session expired.' }) }
    }

    if (!agentId || !/^[a-z0-9_-]+$/.test(agentId) || !filename || typeof filename !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request.' }) }
    }

    // Prevent path traversal — filename must contain no path separators and match sanitised form
    const safeName = filename.replace(/[^a-zA-Z0-9._\-() ]/g, '_').slice(0, 120).trim()
    if (safeName !== filename) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid filename.' }) }
    }

    // Read metadata from agents.json to get mimeType and category
    const agentsPath = path.join(__dirname, '../../data/agents.json')
    let meta
    try {
      const agents = JSON.parse(fs.readFileSync(agentsPath, 'utf8'))
      const agent = agents.find(a => a.id === agentId)
      meta = agent?.agentFiles?.find(f => f.name === filename)
    } catch {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not read agent data.' }) }
    }
    if (!meta) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'File not found.' }) }
    }

    // Read the actual file from the filesystem
    const filePath = path.join(__dirname, '../../data/agent-files', agentId, filename)
    let buf
    try {
      buf = fs.readFileSync(filePath)
    } catch {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'File not available yet. The site may still be rebuilding.' }) }
    }

    const data = meta.category === 'text' ? buf.toString('utf8') : buf.toString('base64')

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ name: meta.name, mimeType: meta.mimeType, category: meta.category, data }),
    }
  } catch (err) {
    console.error('get-agent-file:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to retrieve file.' }) }
  }
}
