const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { getStore } = require('@netlify/blobs')
const { verifySession, corsHeaders } = require('./_auth')

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
const MAX_FILE_DATA = 5_592_405
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

    const jobId = crypto.randomUUID()
    const store = getStore({ name: 'chat-jobs', consistency: 'strong', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN })

    await store.setJSON(jobId, {
      status: 'pending',
      history: Array.isArray(history) ? history.slice(-20) : [],
      userText: userText.trim(),
      userFiles: files || [],
      agentId,
      model: safeModel(agent.model),
      systemPrompt: agent.systemPrompt,
      agentFilesMeta: agent.agentFiles || [],
    })

    // Trigger background function — it returns 202 immediately, runs async
    const siteUrl = (process.env.URL || 'http://localhost:8888').replace(/\/$/, '')
    const triggerRes = await fetch(`${siteUrl}/.netlify/functions/chat-run-background`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_FN_SECRET || '',
      },
      body: JSON.stringify({ jobId }),
    }).catch(err => { console.error('trigger background:', err.message); return null })

    if (!triggerRes || (triggerRes.status !== 202 && triggerRes.status !== 200)) {
      await store.delete(jobId).catch(() => {})
      throw new Error('Failed to start background job')
    }

    return { statusCode: 202, headers, body: JSON.stringify({ jobId }) }
  } catch (err) {
    console.error('chat-start:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to start request. Please try again.' }) }
  }
}
