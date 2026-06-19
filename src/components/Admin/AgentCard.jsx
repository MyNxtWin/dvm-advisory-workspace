import React from 'react'
import './Admin.css'

export default function AgentCard({ agent, onEdit, onDelete }) {
  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <div className="agent-card-icon">{agent.icon || '🤖'}</div>
        <div>
          <div className="agent-card-name">{agent.name}</div>
          <div className="agent-card-id">id: {agent.id}</div>
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
