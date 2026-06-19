import React, { useState, useRef, useMemo } from 'react'
import './Chat.css'

const FILE_ICONS = { image: '🖼️', document: '📄', text: '📋' }

export default function MessageInput({ onSend, disabled, files, resolveFromText }) {
  const [text, setText] = useState('')
  const [mention, setMention] = useState(null)
  const ref = useRef(null)

  function resize() {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = Math.min(ref.current.scrollHeight, 140) + 'px'
    }
  }

  function handleChange(e) {
    const val = e.target.value
    const cursor = e.target.selectionStart
    setText(val)
    resize()
    const before = val.slice(0, cursor)
    const match = before.match(/@([\w.\-]*)$/)
    if (match) {
      setMention({ query: match[1].toLowerCase(), start: before.length - match[0].length })
    } else {
      setMention(null)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setMention(null); return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  function insertMention(isAll, file) {
    const cursor = ref.current?.selectionStart ?? text.length
    const before = text.slice(0, mention.start)
    const after = text.slice(cursor)
    const tag = isAll ? '@all' : `@${file.name}`
    const newText = `${before}${tag} ${after}`
    setText(newText)
    setMention(null)
    setTimeout(() => {
      if (ref.current) {
        const pos = mention.start + tag.length + 1
        ref.current.focus()
        ref.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  function submit() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    const attached = resolveFromText(trimmed)
    onSend(trimmed, attached)
    setText('')
    setMention(null)
    if (ref.current) ref.current.style.height = 'auto'
  }

  const dropdownItems = useMemo(() => {
    if (mention === null || !files?.length) return []
    const q = mention.query
    // only show unpinned files in dropdown (pinned are always attached)
    const unpinned = files.filter(f => !f.pinned)
    const matched = unpinned.filter(f => !q || f.name.toLowerCase().includes(q))
    const showAll = !q || 'all'.startsWith(q)
    return [...(showAll ? [{ __all: true }] : []), ...matched]
  }, [mention, files])

  // Preview which files will be sent with this message
  const willAttach = useMemo(() => {
    if (!files?.length) return []
    return resolveFromText(text.trim())
  }, [text, files, resolveFromText])

  const hasMentionableFiles = (files || []).some(f => !f.pinned)

  return (
    <div className="input-area">
      {mention !== null && dropdownItems.length > 0 && (
        <div className="mention-dropdown">
          {dropdownItems.map(item =>
            item.__all ? (
              <button key="all" className="mention-item" onMouseDown={() => insertMention(true, null)}>
                <span>📎</span>
                <span className="mention-name">@all</span>
                <span className="mention-sub">attach all session files</span>
              </button>
            ) : (
              <button key={item.id} className="mention-item" onMouseDown={() => insertMention(false, item)}>
                <span>{FILE_ICONS[item.category] || '📎'}</span>
                <span className="mention-name">@{item.name}</span>
              </button>
            )
          )}
        </div>
      )}

      {willAttach.length > 0 && (
        <div className="attach-preview">
          <span className="attach-preview-label">Sending:</span>
          {willAttach.map(f => (
            <span key={f.id} className={`attach-chip${f.pinned ? ' pinned' : ''}`}>
              {f.pinned ? '⊙' : '📎'} {f.name}
            </span>
          ))}
        </div>
      )}

      <div className="input-bar">
        <textarea
          ref={ref}
          className="chat-textarea"
          placeholder={hasMentionableFiles ? 'Ask a question… type @ to attach a session file' : 'Ask a question…'}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        <button className="send-btn" onClick={submit} disabled={disabled || !text.trim()}>
          Send
        </button>
      </div>
    </div>
  )
}
