const { getStore } = require('@netlify/blobs')
const { corsHeaders } = require('./_auth')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

exports.handler = async (event) => {
  const cors = corsHeaders(event)
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) }

  const headers = { ...cors, 'Content-Type': 'application/json' }
  const jobId = event.queryStringParameters?.jobId

  if (!jobId || !UUID_RE.test(jobId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid jobId.' }) }
  }

  try {
    const store = getStore({ name: 'chat-jobs', consistency: 'strong' })
    const job = await store.get(jobId, { type: 'json' })

    if (!job) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Job not found.' }) }
    }

    if (job.status === 'done') {
      await store.delete(jobId).catch(() => {})
      return { statusCode: 200, headers, body: JSON.stringify({ status: 'done', response: job.response }) }
    }

    if (job.status === 'error') {
      await store.delete(jobId).catch(() => {})
      return { statusCode: 200, headers, body: JSON.stringify({ status: 'error', error: job.error }) }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ status: 'pending' }) }
  } catch (err) {
    console.error('chat-poll:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to check status.' }) }
  }
}
