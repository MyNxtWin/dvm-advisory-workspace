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

function agentFilePath(agentId, filename) {
  return `data/agent-files/${agentId}/${filename}`
}

// ── agents.json ─────────────────────────────────────────────────────────────

async function fetchAgentsFile() {
  const res = await fetch(repoUrl(process.env.AGENTS_FILE_PATH), { headers: ghHeaders() })
  if (!res.ok) throw new Error('Could not load agents from storage.')
  const data = await res.json()
  return {
    sha: data.sha,
    agents: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')),
  }
}

// Lists all files in data/agent-files/{agentId}/ — returns [] if folder doesn't exist
async function listAgentFolder(agentId) {
  const res = await fetch(repoUrl(`data/agent-files/${agentId}`), { headers: ghHeaders() })
  if (res.status === 404) return []
  if (!res.ok) throw new Error('Could not list agent folder.')
  const data = await res.json()
  return Array.isArray(data) ? data.filter(f => f.type === 'file') : []
}

// ── Batch commit via Git Data API ────────────────────────────────────────────
// changes: array of { path, content, encoding? } for additions
//                 or { path, delete: true } for removals (sha:null = no-op if missing)
async function batchCommit(changes, message) {
  const branch = 'main'
  const baseUrl = `${GITHUB_API}/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`

  // Get current HEAD SHA
  const refRes = await fetch(`${baseUrl}/git/ref/heads/${branch}`, { headers: ghHeaders() })
  if (!refRes.ok) throw new Error('Could not get branch ref.')
  const headSha = (await refRes.json()).object.sha

  // Get the base tree SHA from that commit
  const commitRes = await fetch(`${baseUrl}/git/commits/${headSha}`, { headers: ghHeaders() })
  if (!commitRes.ok) throw new Error('Could not get commit.')
  const baseTreeSha = (await commitRes.json()).tree.sha

  // Create blobs for additions in parallel, build tree entries for deletions
  const treeEntries = await Promise.all(changes.map(async (c) => {
    if (c.delete) {
      return { path: c.path, mode: '100644', type: 'blob', sha: null }
    }
    const b64 = c.encoding === 'base64' ? c.content : Buffer.from(c.content, 'utf8').toString('base64')
    const blobRes = await fetch(`${baseUrl}/git/blobs`, {
      method: 'POST',
      headers: ghHeaders(),
      body: JSON.stringify({ content: b64, encoding: 'base64' }),
    })
    if (!blobRes.ok) throw new Error(`Could not create blob for ${c.path}.`)
    return { path: c.path, mode: '100644', type: 'blob', sha: (await blobRes.json()).sha }
  }))

  // Create new tree on top of base tree
  const treeRes = await fetch(`${baseUrl}/git/trees`, {
    method: 'POST',
    headers: ghHeaders(),
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  })
  if (!treeRes.ok) throw new Error('Could not create tree.')
  const newTreeSha = (await treeRes.json()).sha

  // Create commit
  const newCommitRes = await fetch(`${baseUrl}/git/commits`, {
    method: 'POST',
    headers: ghHeaders(),
    body: JSON.stringify({ message, tree: newTreeSha, parents: [headSha] }),
  })
  if (!newCommitRes.ok) throw new Error('Could not create commit.')
  const newCommitSha = (await newCommitRes.json()).sha

  // Advance the branch ref
  const updateRes = await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: ghHeaders(),
    body: JSON.stringify({ sha: newCommitSha }),
  })
  if (!updateRes.ok) throw new Error('Could not update branch ref.')
}

// ── handler ─────────────────────────────────────────────────────────────────

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

    // ── Save agent — upsert + file adds + file removals in one commit ────
    if (event.httpMethod === 'POST' && body.action === 'saveAgent') {
      const { agent, filesToAdd = [], filesToRemove = [] } = body

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
      for (const file of filesToAdd) {
        if (!file?.name || !file?.data || !file?.mimeType || !file?.category || !file?.size) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing file fields.' }) }
        }
        if (!VALID_AGENT_FILE_CATEGORIES.has(file.category) || typeof file.data !== 'string' || file.data.length > MAX_AGENT_FILE_DATA) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid file data or type.' }) }
        }
      }

      const { agents } = await fetchAgentsFile()
      const existingIdx = agents.findIndex(a => a.id === agent.id)

      // Build new agentFiles metadata: keep existing minus removals, then add new
      let currentFiles = existingIdx >= 0 ? (agents[existingIdx].agentFiles || []) : []
      currentFiles = currentFiles.filter(f => !filesToRemove.includes(f.name))

      const sanitizedAdds = filesToAdd.map(f => ({
        ...f,
        safeName: f.name.replace(/[^a-zA-Z0-9._\-() ]/g, '_').slice(0, 120).trim(),
      })).filter(f => f.safeName)

      if (currentFiles.length + sanitizedAdds.length > MAX_AGENT_FILES) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Maximum ${MAX_AGENT_FILES} files per agent.` }) }
      }
      for (const f of sanitizedAdds) {
        if (currentFiles.some(e => e.name === f.safeName)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: `File "${f.safeName}" already exists on this agent.` }) }
        }
      }

      const updatedAgent = {
        id: agent.id,
        name: agent.name,
        shortName: agent.shortName || '',
        desc: agent.desc || '',
        icon: agent.icon || '',
        model: agent.model || 'claude-haiku-4-5-20251001',
        order: typeof agent.order === 'number' ? agent.order : 99,
        chips: Array.isArray(agent.chips) ? agent.chips.slice(0, 20) : [],
        systemPrompt: agent.systemPrompt,
        agentFiles: [
          ...currentFiles,
          ...sanitizedAdds.map(f => ({ name: f.safeName, mimeType: f.mimeType, category: f.category, size: f.size })),
        ],
        updatedAt: new Date().toISOString(),
      }

      const newAgents = existingIdx >= 0
        ? agents.map((a, i) => i === existingIdx ? updatedAgent : a)
        : [...agents, updatedAgent]
      newAgents.sort((a, b) => (a.order ?? 99) - (b.order ?? 99))

      // Build all file changes for the single commit
      const changes = []

      // agents.json
      changes.push({ path: process.env.AGENTS_FILE_PATH, content: JSON.stringify(newAgents, null, 2) + '\n' })

      // file additions
      for (const f of sanitizedAdds) {
        changes.push({
          path: agentFilePath(agent.id, f.safeName),
          content: f.category === 'text' ? Buffer.from(f.data, 'utf8').toString('base64') : f.data,
          encoding: 'base64',
        })
      }

      // file removals (sha:null = no-op if already missing, safe)
      for (const filename of filesToRemove) {
        changes.push({ path: agentFilePath(agent.id, filename), delete: true })
      }

      const isNew = existingIdx < 0
      await batchCommit(changes, `agent: ${isNew ? 'add' : 'update'} ${agent.id}`)

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    // ── Delete agent + all its files in one commit ───────────────────────
    if (event.httpMethod === 'DELETE') {
      const { agentId } = body
      if (!agentId || !AGENT_ID_RE.test(agentId)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid agentId required.' }) }
      }

      const { agents } = await fetchAgentsFile()
      const filtered = agents.filter(a => a.id !== agentId)
      const folderFiles = await listAgentFolder(agentId)

      const changes = [
        { path: process.env.AGENTS_FILE_PATH, content: JSON.stringify(filtered, null, 2) + '\n' },
        ...folderFiles.map(f => ({ path: f.path, delete: true })),
      ]

      await batchCommit(changes, `agent: remove ${agentId}`)

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (err) {
    console.error('agents-manage:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Operation failed.' }) }
  }
}
