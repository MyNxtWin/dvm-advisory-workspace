const { verifySession, isAdmin, corsHeaders } = require('./_auth')

const GITHUB_API = 'https://api.github.com'
const AGENT_ID_RE = /^[a-z0-9_-]+$/
const FIELD_LIMITS = { name: 100, desc: 500, shortName: 60, icon: 8, systemPrompt: 32768 }

const MAX_AGENT_FILES = 3
const MAX_AGENT_FILE_DATA = 4_194_304 // ~4 MB base64 (~3 MB binary)
const VALID_AGENT_FILE_CATEGORIES = new Set(['image', 'document', 'text'])

function ghHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }
}

function repoUrl(filePath) {
  return `${GITHUB_API}/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${filePath}`
}

// ── agents.json helpers ────────────────────────────────────────────────────

async function fetchAgentsFile() {
  const res = await fetch(repoUrl(process.env.AGENTS_FILE_PATH), { headers: ghHeaders() })
  if (!res.ok) throw new Error('Could not load agents from storage.')
  const data = await res.json()
  return {
    sha: data.sha,
    agents: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')),
  }
}

async function commitAgentsFile(agents, sha, message) {
  const res = await fetch(repoUrl(process.env.AGENTS_FILE_PATH), {
    method: 'PUT',
    headers: ghHeaders(),
    body: JSON.stringify({
      message,
      sha,
      content: Buffer.from(JSON.stringify(agents, null, 2) + '\n').toString('base64'),
    }),
  })
  if (!res.ok) throw new Error('Could not save agents to storage.')
}

// ── agent file helpers — each file is its own path in the repo ─────────────

function agentFilePath(agentId, filename) {
  return `data/agent-files/${agentId}/${filename}`
}

// Returns the GitHub SHA of a single file, or null if it doesn't exist
async function getGithubFileSha(path) {
  const res = await fetch(repoUrl(path), { headers: ghHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Could not check file on GitHub.')
  const data = await res.json()
  return data.sha
}

// Lists all files in data/agent-files/{agentId}/ — returns [] if folder doesn't exist
async function listAgentFolder(agentId) {
  const res = await fetch(repoUrl(`data/agent-files/${agentId}`), { headers: ghHeaders() })
  if (res.status === 404) return []
  if (!res.ok) throw new Error('Could not list agent folder.')
  const data = await res.json()
  return Array.isArray(data) ? data.filter(f => f.type === 'file') : []
}

// ── handler ────────────────────────────────────────────────────────────────

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
    // ── List agents ──────────────────────────────────────────────────────
    if (event.httpMethod === 'POST' && body.action === 'list') {
      const { agents } = await fetchAgentsFile()
      return { statusCode: 200, headers, body: JSON.stringify({ agents }) }
    }

    // ── Upload agent file ────────────────────────────────────────────────
    if (event.httpMethod === 'POST' && body.action === 'uploadAgentFile') {
      const { agentId, file } = body

      if (!agentId || !AGENT_ID_RE.test(agentId)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid agentId.' }) }
      }
      if (!file?.name || !file?.data || !file?.mimeType || !file?.category || !file?.size) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing file fields.' }) }
      }
      if (!VALID_AGENT_FILE_CATEGORIES.has(file.category) || typeof file.data !== 'string' || file.data.length > MAX_AGENT_FILE_DATA) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid file data or type.' }) }
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._\-() ]/g, '_').slice(0, 120).trim()
      if (!safeName) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid filename.' }) }

      // Check current metadata count
      const { sha: agentsSha, agents } = await fetchAgentsFile()
      const idx = agents.findIndex(a => a.id === agentId)
      if (idx < 0) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Agent not found.' }) }

      const existingMeta = agents[idx].agentFiles || []
      if (existingMeta.length >= MAX_AGENT_FILES) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Maximum ${MAX_AGENT_FILES} files per agent.` }) }
      }
      if (existingMeta.some(f => f.name === safeName)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'A file with that name already exists.' }) }
      }

      // Write the actual file to data/agent-files/{agentId}/{safeName}
      // GitHub always wants base64-encoded content in the API
      const githubContent = file.category === 'text'
        ? Buffer.from(file.data, 'utf8').toString('base64')
        : file.data // already base64

      const existingSha = await getGithubFileSha(agentFilePath(agentId, safeName))
      const putBody = {
        message: `agent-files: add ${safeName} to ${agentId}`,
        content: githubContent,
      }
      if (existingSha) putBody.sha = existingSha

      const putRes = await fetch(repoUrl(agentFilePath(agentId, safeName)), {
        method: 'PUT',
        headers: ghHeaders(),
        body: JSON.stringify(putBody),
      })
      if (!putRes.ok) {
        console.error('agents-manage: file upload failed:', await putRes.text())
        throw new Error('Could not upload file to GitHub.')
      }

      // Update metadata in agents.json (no file content stored here)
      agents[idx].agentFiles = [...existingMeta, { name: safeName, mimeType: file.mimeType, category: file.category, size: file.size }]
      await commitAgentsFile(agents, agentsSha, `agent-files: update metadata for ${agentId}`)

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, name: safeName }) }
    }

    // ── Remove agent file ────────────────────────────────────────────────
    if (event.httpMethod === 'POST' && body.action === 'removeAgentFile') {
      const { agentId, filename } = body

      if (!agentId || !AGENT_ID_RE.test(agentId) || !filename || typeof filename !== 'string') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request.' }) }
      }
      if (filename !== filename.replace(/[^a-zA-Z0-9._\-() ]/g, '_').slice(0, 120).trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid filename.' }) }
      }

      const sha = await getGithubFileSha(agentFilePath(agentId, filename))
      if (!sha) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'File not found.' }) }
      }

      // Update metadata FIRST — stale metadata pointing to a missing file causes 404s on download.
      // An orphaned file in GitHub (if delete below fails) is harmless.
      const { sha: agentsSha, agents } = await fetchAgentsFile()
      const idx = agents.findIndex(a => a.id === agentId)
      if (idx >= 0 && agents[idx].agentFiles) {
        agents[idx].agentFiles = agents[idx].agentFiles.filter(f => f.name !== filename)
        await commitAgentsFile(agents, agentsSha, `agent-files: update metadata for ${agentId}`)
      }

      // Delete the actual file from GitHub
      const delRes = await fetch(repoUrl(agentFilePath(agentId, filename)), {
        method: 'DELETE',
        headers: ghHeaders(),
        body: JSON.stringify({
          message: `agent-files: remove ${filename} from ${agentId}`,
          sha,
        }),
      })
      if (!delRes.ok) {
        console.error('agents-manage: GitHub file delete failed:', await delRes.text())
        // Metadata is already clean — orphaned file in GitHub won't be served
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    // ── Upsert agent ─────────────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const { agent } = body
      if (!agent?.id || !agent?.name || !agent?.systemPrompt) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id, name, and systemPrompt are required.' }) }
      }
      if (!AGENT_ID_RE.test(agent.id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id must be lowercase alphanumeric with hyphens/underscores only.' }) }
      }

      for (const [field, max] of Object.entries(FIELD_LIMITS)) {
        if (agent[field] && String(agent[field]).length > max) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: `${field} exceeds maximum length of ${max} characters.` }) }
        }
      }

      const { sha, agents } = await fetchAgentsFile()
      const existing = agents.findIndex(a => a.id === agent.id)

      const updated = {
        id: agent.id,
        name: agent.name,
        shortName: agent.shortName || '',
        desc: agent.desc || '',
        icon: agent.icon || '',
        model: agent.model || 'claude-haiku-4-5-20251001',
        order: typeof agent.order === 'number' ? agent.order : 99,
        chips: Array.isArray(agent.chips) ? agent.chips.slice(0, 20) : [],
        systemPrompt: agent.systemPrompt,
        agentFiles: existing >= 0 ? (agents[existing].agentFiles || []) : [],
        updatedAt: new Date().toISOString(),
      }

      if (existing >= 0) {
        agents[existing] = updated
      } else {
        agents.push(updated)
      }
      agents.sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
      await commitAgentsFile(agents, sha, `agent: ${existing >= 0 ? 'update' : 'add'} ${agent.id}`)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    // ── Delete agent ─────────────────────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      const { agentId } = body
      if (!agentId || !AGENT_ID_RE.test(agentId)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid agentId required.' }) }
      }

      const { sha, agents } = await fetchAgentsFile()
      const filtered = agents.filter(a => a.id !== agentId)
      await commitAgentsFile(filtered, sha, `agent: remove ${agentId}`)

      // Best-effort: delete all files in data/agent-files/{agentId}/ — agent is already gone
      // from agents.json so orphaned files can't be accessed even if cleanup partially fails.
      try {
        const folderFiles = await listAgentFolder(agentId)
        for (const f of folderFiles) {
          const res = await fetch(repoUrl(f.path), {
            method: 'DELETE',
            headers: ghHeaders(),
            body: JSON.stringify({
              message: `agent-files: remove ${f.name} (agent ${agentId} deleted)`,
              sha: f.sha,
            }),
          })
          if (!res.ok) console.error(`agents-manage: failed to delete ${f.name}:`, await res.text())
        }
      } catch (e) {
        console.error('agents-manage: folder cleanup failed:', e.message)
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (err) {
    console.error('agents-manage:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Operation failed.' }) }
  }
}
