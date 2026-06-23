import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import AgentCard from './AgentCard'
import AgentForm from './AgentForm'
import './Admin.css'

export default function AdminPanel() {
  const { auth, agents } = useApp()
  const navigate = useNavigate()
  const [allAgents, setAllAgents] = useState([])
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function call(method, body) {
    const res = await fetch('/.netlify/functions/agents-manage', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        email: auth.user.email,
        sessionToken: auth.user.sessionToken,
        sessionExpiry: auth.user.sessionExpiry,
      }),
    })
    const data = await res.json()
    // Backend is the real gatekeeper — redirect immediately on auth/permission failure
    if (res.status === 401) { auth.logout(); return null }
    if (res.status === 403) { navigate('/', { replace: true }); return null }
    if (!res.ok) throw new Error(data.error || 'Operation failed')
    return data
  }

  async function load() {
    try {
      const data = await call('POST', { action: 'list' })
      if (data) setAllAgents(data.agents || [])
    } catch (e) {
      setMsg('Failed to load agents: ' + e.message)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSave(agent, pendingFiles = [], pendingRemovals = []) {
    setSaving(true)
    setMsg('')
    try {
      await call('POST', {
        action: 'saveAgent',
        agent,
        filesToAdd: pendingFiles,
        filesToRemove: pendingRemovals,
      })
      setMsg('Agent saved successfully.')
      setShowForm(false)
      setEditing(null)
      await load()
      await agents.reload()
    } catch (e) {
      setMsg('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(agentId) {
    if (!confirm(`Delete agent "${agentId}"? This cannot be undone.`)) return
    try {
      await call('DELETE', { agentId })
      setMsg('Agent deleted.')
      await load()
      await agents.reload()
    } catch (e) {
      setMsg('Error: ' + e.message)
    }
  }

  function openNew() { setEditing(null); setShowForm(true) }
  function openEdit(agent) { setEditing(agent); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditing(null) }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1>Agent Management</h1>
          <p>Create and manage AI agents. Changes take effect immediately — no redeployment needed.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ New Agent</button>
      </div>

      {msg && (
        <div className={msg.startsWith('Error') || msg.startsWith('Failed') ? 'auth-error' : 'auth-info'} style={{ marginBottom: 16, maxWidth: 600 }}>
          {msg}
        </div>
      )}

      {allAgents.length === 0 ? (
        <div className="admin-empty">
          <p>No agents yet. Create your first agent.</p>
          <button className="btn btn-primary" onClick={openNew}>+ New Agent</button>
        </div>
      ) : (
        <div className="agents-grid">
          {allAgents.map(a => (
            <AgentCard key={a.id} agent={a} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showForm && (
        <AgentForm
          agent={editing}
          onSave={handleSave}
          onClose={closeForm}
          saving={saving}
        />
      )}
    </div>
  )
}
