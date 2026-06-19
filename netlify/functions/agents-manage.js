const { verifySession, isAdmin, corsHeaders } = require('./_auth')

const GITHUB_API = 'https://api.github.com'

function ghHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }
}

function fileUrl() {
  return `${GITHUB_API}/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${process.env.AGENTS_FILE_PATH}`
}

async function fetchFile() {
  const res = await fetch(fileUrl(), { headers: ghHeaders() })
  if (!res.ok) throw new Error('Could not fetch agents file from GitHub: ' + await res.text())
  const data = await res.json()
  return {
    sha: data.sha,
    agents: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')),
  }
}

async function commitFile(agents, sha, message) {
  const res = await fetch(fileUrl(), {
    method: 'PUT',
    headers: ghHeaders(),
    body: JSON.stringify({
      message,
      sha,
      content: Buffer.from(JSON.stringify(agents, null, 2) + '\n').toString('base64'),
    }),
  })
  if (!res.ok) throw new Error('Could not commit agents file: ' + await res.text())
}

exports.handler = async (event) => {
  const cors = corsHeaders(event)
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }

  const headers = { ...cors, 'Content-Type': 'application/json' }

  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch {}

  const { email, sessionToken, sessionExpiry } = body
  if (!verifySession(email, sessionToken, sessionExpiry)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Session expired.' }) }
  }
  if (!isAdmin(email)) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required.' }) }
  }

  try {
    if (event.httpMethod === 'GET') {
      const { agents } = await fetchFile()
      return { statusCode: 200, headers, body: JSON.stringify({ agents }) }
    }

    if (event.httpMethod === 'POST') {
      const { agent } = body
      if (!agent?.id || !agent?.name || !agent?.systemPrompt) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id, name, and systemPrompt are required.' }) }
      }
      if (!/^[a-z0-9_-]+$/.test(agent.id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id must be lowercase alphanumeric with hyphens/underscores only.' }) }
      }
      const { sha, agents } = await fetchFile()
      const existing = agents.findIndex(a => a.id === agent.id)
      const updated = { ...agent, updatedAt: new Date().toISOString() }
      if (existing >= 0) {
        agents[existing] = updated
      } else {
        agents.push(updated)
      }
      agents.sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
      await commitFile(agents, sha, `agent: ${existing >= 0 ? 'update' : 'add'} ${agent.id}`)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    if (event.httpMethod === 'DELETE') {
      const { agentId } = body
      if (!agentId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'agentId required.' }) }
      const { sha, agents } = await fetchFile()
      const filtered = agents.filter(a => a.id !== agentId)
      await commitFile(filtered, sha, `agent: remove ${agentId}`)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (err) {
    console.error('agents-manage:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Operation failed.' }) }
  }
}
