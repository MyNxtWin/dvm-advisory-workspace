import React from 'react'
import './Admin.css'

const MODEL_LABELS = {
  'claude-haiku-4-5-20251001': '⚡ Haiku 4.5',
  'claude-sonnet-4-6': '⚖️ Sonnet 4.6',
  'claude-opus-4-8': '🧠 Opus 4.8',
}

export default function AgentCard({ agent, onEdit, onDelete }) {
  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <div className="agent-card-icon">{agent.icon || '🤖'}</div>
        <div>
          <div className="agent-card-name">{agent.name}</div>
          <div className="agent-card-id">id: {agent.id}</div>
          {agent.model && (
            <span className="agent-card-model">{MODEL_LABELS[agent.model] || agent.model}</span>
          )}
        </div>
      </div>
      <div className="agent-card-desc">{agent.desc}</div>
      <div className="agent-card-actions">
        <button className="btn btn-ghost" onClick={() => onEdit(agent)} style={{ fontSize: 12 }}>
          Edit
        </button>
        <button className="btn btn-danger" onClick={() => onDelete(agent.id)} style={{ fontSize: 12 }}>
          Delete
        </button>
      </div>
    </div>
  )
}
