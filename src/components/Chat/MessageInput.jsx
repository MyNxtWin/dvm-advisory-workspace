import React, { useState, useRef, useMemo } from 'react'
import './Chat.css'

const FILE_ICONS = { image: '🖼️', document: '📄', text: '📋' }

function resolveMentions(text, files) {
  if (!files?.length || !text) return []
  const lower = text.toLowerCase()
  if (lower.includes('@all')) return files
  return files.filter(f => {
    const n = f.name.toLowerCase()
    const noExt = n.replace(/\.[^.]+$/, '')
    return lower.includes(`@${n}`) || lower.includes(`@${noExt}`)
  })
}

export default function MessageInput({ onSend, disabled, files }) {
  const [text, setText] = useState('')
  const [mention, setMention] = useState(null) // { query, start } | null
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
    const attached = resolveMentions(trimmed, files)
    onSend(trimmed, attached)
    setText('')
    setMention(null)
    if (ref.current) ref.current.style.height = 'auto'
  }

  const dropdownItems = useMemo(() => {
    if (mention === null || !files?.length) return []
    const q = mention.query
    const matched = files.filter(f => !q || f.name.toLowerCase().includes(q))
    const showAll = !q || 'all'.startsWith(q)
    return [...(showAll ? [{ __all: true }] : []), ...matched]
  }, [mention, files])

  return (
    <div className="input-bar">
      {mention !== null && dropdownItems.length > 0 && (
        <div className="mention-dropdown">
          {dropdownItems.map(item =>
            item.__all ? (
              <button key="all" className="mention-item" onMouseDown={() => insertMention(true, null)}>
                <span>📎</span>
                <span className="mention-name">@all</span>
                <span className="mention-sub">attach all files</span>
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
      <textarea
        ref={ref}
        className="chat-textarea"
        placeholder="Ask a question… type @ to attach a file"
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
  )
}
