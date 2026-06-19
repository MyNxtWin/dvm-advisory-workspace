import React, { useState, useRef, useEffect } from 'react'
import './Chat.css'

export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = Math.min(ref.current.scrollHeight, 140) + 'px'
    }
  }, [text])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  return (
    <div className="input-bar">
      <textarea
        ref={ref}
        className="chat-textarea"
        placeholder="Ask a question… (Shift+Enter for new line)"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
      />
      <button className="send-btn" onClick={submit} disabled={disabled || !text.trim()}>
        Send
      </button>
    </div>
  )
}
