const fs = require('fs')
const path = require('path')
const { getStore } = require('@netlify/blobs')

function getAgentFiles(agentId, agentFilesMeta) {
  if (!agentFilesMeta?.length) return []
  const result = []
  for (const meta of agentFilesMeta) {
    try {
      const filePath = path.join(__dirname, '../../data/agent-files', agentId, meta.name)
      const buf = fs.readFileSync(filePath)
      result.push({
        name: meta.name,
        mimeType: meta.mimeType,
        category: meta.category,
        data: meta.category === 'text' ? buf.toString('utf8') : buf.toString('base64'),
      })
    } catch {
      // file missing from deploy — skip
    }
  }
  return result
}

function buildContent(agentFiles, userFiles, userText) {
  const allFiles = [...agentFiles, ...userFiles]
  if (allFiles.length === 0) return userText
  const blocks = []
  for (const f of allFiles) {
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
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' }

  const secret = process.env.INTERNAL_FN_SECRET
  if (!secret || event.headers['x-internal-secret'] !== secret) {
    return { statusCode: 403, body: '' }
  }

  const { jobId } = JSON.parse(event.body || '{}')
  if (!jobId) return { statusCode: 400, body: '' }

  const store = getStore({ name: 'chat-jobs', consistency: 'strong', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN })

  try {
    const job = await store.get(jobId, { type: 'json' })
    if (!job) return { statusCode: 404, body: '' }

    const agentFiles = getAgentFiles(job.agentId, job.agentFilesMeta)
    const validHistory = (job.history || [])
      .filter(m => m.role && m.content)
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: typeof m.content === 'string' ? m.content.slice(0, 8000) : m.content,
      }))

    const currentContent = buildContent(agentFiles, job.userFiles || [], job.userText)
    const allMessages = [...validHistory, { role: 'user', content: currentContent }]

    const hasPDF = agentFiles.some(f => f.category === 'document') || (job.userFiles || []).some(f => f.category === 'document')
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
        model: job.model,
        max_tokens: 8096,
        system: [{ type: 'text', text: job.systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: allMessages,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'API error')

    const text = data.content?.[0]?.text || ''
    await store.setJSON(jobId, { status: 'done', response: text })
  } catch (err) {
    console.error('chat-run-background:', err.message)
    await store.setJSON(jobId, { status: 'error', error: 'Failed to get response. Please try again.' }).catch(() => {})
  }
}
