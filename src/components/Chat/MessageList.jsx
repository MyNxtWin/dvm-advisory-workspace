import React, { useEffect, useRef } from 'react'
import './Chat.css'

export default function MessageList({ messages, agent, isLoading, onChipClick }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (!agent) {
    return (
      <div className="messages-area welcome">
        <div className="welcome-icon">⚖️</div>
        <div className="welcome-name">Select an agent</div>
        <div className="welcome-desc">Choose an agent from the sidebar to get started.</div>
      </div>
    )
  }

  const chips = agent.chips || []

  if (messages.length === 0) {
    return (
      <div className="messages-area welcome">
        <div className="welcome-icon">{agent.icon || '🤖'}</div>
        <div className="welcome-name">{agent.name}</div>
        <div className="welcome-desc">{agent.desc}</div>
        {chips.length > 0 && (
          <div className="chips">
            {chips.map((c, i) => (
              <button key={i} className="chip" onClick={() => onChipClick(c)}>{c}</button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="messages-area">
      {messages.map((msg, i) => (
        <div key={i} className={`msg ${msg.role}`}>
          {msg.role === 'assistant' && (
            <div className="msg-avatar">{agent.icon || '🤖'}</div>
          )}
          <div className="msg-bubble">{msg.content}</div>
        </div>
      ))}
      {isLoading && (
        <div className="msg assistant">
          <div className="msg-avatar">{agent.icon || '🤖'}</div>
          <div className="typing-bubble">
            <span /><span /><span />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
