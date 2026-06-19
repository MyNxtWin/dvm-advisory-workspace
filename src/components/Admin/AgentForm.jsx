import React, { useState, useEffect } from 'react'
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

const EMPTY = { id: '', name: '', shortName: '', desc: '', icon: '', systemPrompt: '', chips: '', order: 99, model: 'claude-haiku-4-5-20251001' }

export default function AgentForm({ agent, onSave, onClose, saving }) {
  const [form, setForm] = useState(EMPTY)
  const isEdit = !!agent?.id

  useEffect(() => {
    const base = agent ? { ...EMPTY, ...agent } : EMPTY
    // chips stored as array, edited as one-per-line textarea
    base.chips = Array.isArray(base.chips) ? base.chips.join('\n') : (base.chips || '')
    setForm(base)
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
    onSave(payload)
  }

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
