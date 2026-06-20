import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import './Admin.css'

const MODELS = [
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Haiku 4.5',
    badge: '⚡ Fast',
    desc: 'Quick Q&A, summaries, high-volume lookups. Most cost-effective.',
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Sonnet 4.6',
    badge: '⚖️ Balanced',
    desc: 'Better reasoning and nuance. Good for complex analysis and structured responses.',
  },
  {
    id: 'claude-opus-4-8',
    label: 'Opus 4.8',
    badge: '🧠 Powerful',
    desc: 'Most capable. Best for deep legal analysis and multi-step compliance work.',
  },
]

const MIME_CATEGORY = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/gif': 'image', 'image/webp': 'image',
  'application/pdf': 'document',
  'text/plain': 'text', 'text/csv': 'text', 'text/markdown': 'text',
}

const MAX_AGENT_FILES = 3
const MAX_FILE_BYTES = 3 * 1024 * 1024

const EMPTY = { id: '', name: '', shortName: '', desc: '', icon: '', systemPrompt: '', chips: '', order: 99, model: 'claude-haiku-4-5-20251001' }

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readAsBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => res(e.target.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

function readAsText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => res(e.target.result)
    r.onerror = rej
    r.readAsText(file)
  })
}

export default function AgentForm({ agent, onSave, onClose, saving }) {
  const { auth } = useApp()
  const [form, setForm] = useState(EMPTY)
  // agentFiles = already on server (edit mode); pendingFiles = staged locally (create mode)
  const [agentFiles, setAgentFiles] = useState([])
  const [pendingFiles, setPendingFiles] = useState([])
  const [fileMsg, setFileMsg] = useState('')
  const [fileUploading, setFileUploading] = useState(false)
  const [fileRemoving, setFileRemoving] = useState(null)
  const fileInputRef = useRef(null)
  const isEdit = !!agent?.id

  useEffect(() => {
    const base = agent ? { ...EMPTY, ...agent } : EMPTY
    base.chips = Array.isArray(base.chips) ? base.chips.join('\n') : (base.chips || '')
    setForm(base)
    setAgentFiles(agent?.agentFiles || [])
    setPendingFiles([])
    setFileMsg('')
  }, [agent])

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.id || !form.name || !form.systemPrompt || !form.model?.trim()) return
    const payload = {
      ...form,
      chips: form.chips.split('\n').map(s => s.trim()).filter(Boolean),
    }
    // Pass pendingFiles to parent so it can upload them after the agent is created
    onSave(payload, isEdit ? [] : pendingFiles)
  }

  async function callManage(body) {
    const res = await fetch('/.netlify/functions/agents-manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        email: auth.user.email,
        sessionToken: auth.user.sessionToken,
        sessionExpiry: auth.user.sessionExpiry,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Operation failed')
    return data
  }

  const totalFiles = agentFiles.length + pendingFiles.length
  const canAddMore = totalFiles < MAX_AGENT_FILES

  async function handleFileSelect(e) {
    const file = e.target.files[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return

    if (file.size > MAX_FILE_BYTES) {
      setFileMsg(`File too large (max ${fmtSize(MAX_FILE_BYTES)})`)
      return
    }
    const category = MIME_CATEGORY[file.type]
    if (!category) {
      setFileMsg('Unsupported file type. Use PDF, image, TXT, or CSV.')
      return
    }
    if (totalFiles >= MAX_AGENT_FILES) {
      setFileMsg(`Maximum ${MAX_AGENT_FILES} files per agent.`)
      return
    }

    setFileUploading(true)
    setFileMsg('')

    try {
      const data = category === 'text' ? await readAsText(file) : await readAsBase64(file)

      if (isEdit) {
        // Edit mode: upload immediately
        const result = await callManage({
          action: 'uploadAgentFile',
          agentId: agent.id,
          file: { name: file.name, mimeType: file.type, category, data, size: file.size },
        })
        setAgentFiles(prev => [...prev, { name: result.name, mimeType: file.type, category, size: file.size }])
        setFileMsg('File added. Takes effect after site rebuilds (~1 min).')
      } else {
        // Create mode: stage locally, will be uploaded after agent is saved
        setPendingFiles(prev => [...prev, { name: file.name, mimeType: file.type, category, data, size: file.size }])
        setFileMsg('')
      }
    } catch (err) {
      setFileMsg('Upload failed: ' + err.message)
    } finally {
      setFileUploading(false)
    }
  }

  async function handleRemoveServerFile(filename) {
    if (!confirm(`Remove "${filename}" from this agent?`)) return
    setFileRemoving(filename)
    setFileMsg('')
    try {
      await callManage({ action: 'removeAgentFile', agentId: agent.id, filename })
      setAgentFiles(prev => prev.filter(f => f.name !== filename))
      setFileMsg('File removed.')
    } catch (err) {
      setFileMsg('Remove failed: ' + err.message)
    } finally {
      setFileRemoving(null)
    }
  }

  function handleRemovePending(name) {
    setPendingFiles(prev => prev.filter(f => f.name !== name))
  }

  const ICONS = { image: '🖼️', document: '📄', text: '📋' }

  return (
    <div className="agent-form-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="agent-form-modal">
        <h2>{isEdit ? 'Edit Agent' : 'New Agent'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Agent ID *</label>
            <input
              className="form-input"
              placeholder="e.g. financial-analysis"
              value={form.id}
              onChange={e => set('id', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              disabled={isEdit}
              required
            />
            <div className="form-hint">Lowercase letters, numbers, hyphens, underscores. Cannot be changed after creation.</div>
          </div>
          <div className="form-row">
            <label>Full Name *</label>
            <input className="form-input" placeholder="e.g. Financial Analysis Expert" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div className="form-row">
            <label>Short Name</label>
            <input className="form-input" placeholder="e.g. FA Expert" value={form.shortName} onChange={e => set('shortName', e.target.value)} />
          </div>
          <div className="form-row">
            <label>Description</label>
            <input className="form-input" placeholder="Brief description shown in sidebar" value={form.desc} onChange={e => set('desc', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-row" style={{ flex: 1 }}>
              <label>Icon (emoji)</label>
              <input className="form-input" placeholder="📊" value={form.icon} onChange={e => set('icon', e.target.value)} maxLength={4} />
            </div>
            <div className="form-row" style={{ flex: 1 }}>
              <label>Order</label>
              <input className="form-input" type="number" min={0} value={form.order} onChange={e => set('order', Number(e.target.value))} />
            </div>
          </div>
          <div className="form-row">
            <label>Suggestion Chips</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 100 }}
              placeholder={'One suggestion per line, e.g.:\nWhat are the filing requirements for a board meeting?\nWalk me through issuing ESOPs'}
              value={form.chips}
              onChange={e => set('chips', e.target.value)}
            />
            <div className="form-hint">These appear as quick-start prompts on the chat welcome screen. One per line.</div>
          </div>
          <div className="form-row">
            <label>AI Model</label>
            <div className="model-picker">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  className={`model-option${form.model === m.id ? ' selected' : ''}`}
                  onClick={() => set('model', m.id)}
                >
                  <div className="model-option-top">
                    <span className="model-label">{m.label}</span>
                    <span className="model-badge">{m.badge}</span>
                  </div>
                  <div className="model-desc">{m.desc}</div>
                </button>
              ))}
              <button
                type="button"
                className={`model-option${!MODELS.some(m => m.id === form.model) ? ' selected' : ''}`}
                onClick={() => { if (MODELS.some(m => m.id === form.model)) set('model', '') }}
              >
                <div className="model-option-top">
                  <span className="model-label">Custom</span>
                  <span className="model-badge">✏️ Any</span>
                </div>
                <div className="model-desc">Use any model ID — for new releases not listed here.</div>
              </button>
            </div>
            {!MODELS.some(m => m.id === form.model) && (
              <div style={{ marginTop: 8 }}>
                <input
                  className="form-input"
                  placeholder="e.g. claude-sonnet-4-7"
                  value={form.model}
                  onChange={e => set('model', e.target.value.trim())}
                  autoFocus
                />
                <div className="form-hint">
                  Find all model IDs at{' '}
                  <a href="https://docs.anthropic.com/en/docs/about-claude/models/overview" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                    docs.anthropic.com → Models overview
                  </a>
                  . Format: <code style={{ fontFamily: 'monospace', fontSize: 11 }}>claude-[name]-[version]</code>
                </div>
              </div>
            )}
          </div>
          <div className="form-row">
            <label>System Prompt *</label>
            <textarea
              className="form-textarea"
              placeholder="Write the agent's full system prompt here. This is kept server-side and never exposed to users."
              value={form.systemPrompt}
              onChange={e => set('systemPrompt', e.target.value)}
              required
            />
            <div className="form-hint">This prompt is stored securely and never sent to the browser.</div>
          </div>

          {/* ── Reference Documents ── */}
          <div className="form-row">
            <label>Reference Documents</label>
            <div className="agent-files-section">

              {/* Already-on-server files (edit mode) */}
              {agentFiles.map(f => (
                <div key={f.name} className="agent-file-row">
                  <span className="agent-file-icon">{ICONS[f.category] || '📎'}</span>
                  <span className="agent-file-name" title={f.name}>{f.name}</span>
                  <span className="agent-file-size">{fmtSize(f.size)}</span>
                  <button
                    type="button"
                    className="agent-file-remove"
                    onClick={() => handleRemoveServerFile(f.name)}
                    disabled={fileRemoving === f.name}
                    title="Remove"
                  >
                    {fileRemoving === f.name ? '…' : '×'}
                  </button>
                </div>
              ))}

              {/* Staged (pending) files — create mode */}
              {pendingFiles.map(f => (
                <div key={f.name} className="agent-file-row agent-file-row--pending">
                  <span className="agent-file-icon">{ICONS[f.category] || '📎'}</span>
                  <span className="agent-file-name" title={f.name}>{f.name}</span>
                  <span className="agent-file-size">{fmtSize(f.size)}</span>
                  <span className="agent-file-pending-badge">queued</span>
                  <button
                    type="button"
                    className="agent-file-remove"
                    onClick={() => handleRemovePending(f.name)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}

              {totalFiles === 0 && (
                <div className="agent-files-empty">
                  No reference documents attached. Uploaded files are permanently included in every chat session with this agent.
                </div>
              )}

              {canAddMore && (
                <div className="agent-file-upload-row">
                  <button
                    type="button"
                    className="btn btn-ghost agent-file-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={fileUploading}
                  >
                    {fileUploading ? 'Reading…' : '+ Add file'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.md"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                  <span className="agent-files-limit">{totalFiles}/{MAX_AGENT_FILES} files · max 3 MB each</span>
                </div>
              )}

              {fileMsg && (
                <div className={`agent-file-msg${fileMsg.startsWith('Upload failed') || fileMsg.startsWith('Remove failed') || fileMsg.startsWith('File too') || fileMsg.startsWith('Unsupported') || fileMsg.startsWith('Maximum') ? ' error' : ''}`}>
                  {fileMsg}
                </div>
              )}
            </div>
            <div className="form-hint">
              {isEdit
                ? 'Files are always sent to the AI with every message. Changes take effect after the site rebuilds (~1–2 min). Users can download these files.'
                : 'Files will be uploaded when you save the agent, then take effect after the site rebuilds (~1–2 min).'}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.id || !form.name || !form.systemPrompt || !form.model?.trim()}>
              {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create agent')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
