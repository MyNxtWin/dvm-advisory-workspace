import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import './Layout.css'

export default function Sidebar({ open, onClose }) {
  const { agents, chat } = useApp()
  const [query, setQuery] = useState('')

  const filtered = agents.agents.filter(a =>
    !query ||
    a.name.toLowerCase().includes(query.toLowerCase()) ||
    a.desc?.toLowerCase().includes(query.toLowerCase())
  )

  function selectAgent(id) {
    chat.switchAgent(id)
    onClose?.()
  }

  return (
    <>
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-top">
          <div className="sidebar-search">
            <span className="sidebar-search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search agents…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="sidebar-scroll">
          <div className="sidebar-section-label">Agents</div>
          {filtered.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--ink-3)', padding: '8px 6px' }}>No agents found.</p>
          )}
          {filtered.map(agent => (
            <button
              key={agent.id}
              className={`agent-item${chat.currentAgentId === agent.id ? ' active' : ''}`}
              onClick={() => selectAgent(agent.id)}
            >
              <span className="agent-item-icon">{agent.icon || '🤖'}</span>
              <div className="agent-item-info">
                <div className="agent-item-name">{agent.shortName || agent.name}</div>
                <div className="agent-item-desc">{agent.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <button className="new-chat-btn" onClick={() => { chat.newChat(); onClose?.() }} disabled={!chat.currentAgentId}>
            + New chat
          </button>
        </div>
      </aside>
    </>
  )
}
