import React, { useState, useRef, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import FilePanel from '../Files/FilePanel'
import './Chat.css'

// ── Simple markdown → HTML for PDF export ──────────────────────────────────
function mdToHtml(text) {
  // Tables: | col | col |\n|---|---|\n| val | val |
  text = text.replace(
    /\|(.+)\|\r?\n\|[\s|:-]+\|\r?\n((?:\|.+\|\r?\n?)*)/gm,
    (_, header, body) => {
      const ths = header.split('|').filter(s => s.trim()).map(s => `<th>${s.trim()}</th>`).join('')
      const trs = body.trim().split('\n').filter(Boolean).map(row => {
        const tds = row.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(s => `<td>${s.trim()}</td>`).join('')
        return `<tr>${tds}</tr>`
      }).join('')
      return `<div class="tbl-wrap"><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
    }
  )
  // Code blocks
  text = text.replace(/```[\w]*\n?([\s\S]*?)```/gm, (_, code) => `<pre><code>${code.trim()}</code></pre>`)
  // Headings
  text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  text = text.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  // Bold / italic
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
  // Horizontal rule
  text = text.replace(/^---$/gm, '<hr>')
  // Ordered + unordered lists (simple — group consecutive li into ul/ol)
  text = text.replace(/((?:^[-*] .+\n?)+)/gm, match => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^[-*] /, '').trim()}</li>`).join('')
    return `<ul>${items}</ul>`
  })
  text = text.replace(/((?:^\d+\. .+\n?)+)/gm, match => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '').trim()}</li>`).join('')
    return `<ol>${items}</ol>`
  })
  // Paragraphs
  const blocks = text.split(/\n\n+/)
  text = blocks.map(b => {
    b = b.trim()
    if (!b) return ''
    if (/^<(h[1-6]|ul|ol|pre|div|table|hr)/.test(b)) return b
    return `<p>${b.replace(/\n/g, '<br>')}</p>`
  }).join('\n')
  return text
}

function buildPrintHtml(messages, agentName) {
  const rows = messages.map(m => {
    const isUser = m.role === 'user'
    const label = isUser ? 'You' : agentName
    const content = isUser
      ? `<p>${m.content.replace(/\n/g, '<br>').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
      : mdToHtml(m.content)
    return `
      <div class="msg ${isUser ? 'user' : 'agent'}">
        <div class="label">${label}</div>
        <div class="body">${content}</div>
      </div>`
  }).join('<div class="divider"></div>')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${agentName} — Chat Export</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; font-size: 13px; color: #1a1a1a; max-width: 780px; margin: 0 auto; padding: 2rem; }
  h1.title { font-size: 16px; font-weight: 700; border-bottom: 2px solid #1a3a5c; padding-bottom: 8px; margin-bottom: 1.5rem; color: #1a3a5c; }
  .msg { margin: 0; }
  .label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8a8a8a; margin-bottom: 6px; }
  .body { line-height: 1.65; }
  .msg.user .body { background: #f0f4f8; padding: 10px 14px; border-radius: 6px; font-size: 13px; }
  .divider { border-top: 1px solid #eee; margin: 1rem 0; }
  p { margin: 0.3em 0; }
  p:first-child { margin-top: 0; }
  h1,h2,h3 { font-family: Georgia, serif; margin: 0.8em 0 0.3em; }
  h1 { font-size: 1.1em; } h2 { font-size: 1em; } h3 { font-size: 0.95em; }
  strong { font-weight: 700; }
  ul, ol { margin: 0.3em 0 0.3em 1.4em; }
  li { margin: 0.2em 0; }
  code { font-family: monospace; background: #f5f5f3; padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f5f5f3; border: 1px solid #e0e0e0; border-radius: 5px; padding: 10px 12px; overflow-x: auto; margin: 0.5em 0; }
  pre code { background: none; padding: 0; font-size: 0.88em; }
  .tbl-wrap { overflow-x: auto; margin: 0.6em 0; }
  table { border-collapse: collapse; min-width: 100%; font-size: 12px; }
  th { background: #f0f4f8; font-weight: 600; text-align: left; padding: 6px 10px; border: 1px solid #ddd; }
  td { padding: 5px 10px; border: 1px solid #e8e8e8; vertical-align: top; }
  hr { border: none; border-top: 1px solid #ddd; margin: 0.6em 0; }
  @media print { body { padding: 1rem; } }
</style>
</head>
<body>
<h1 class="title">${agentName} — Chat Export</h1>
${rows}
<script>window.onload = () => window.print()</script>
</body>
</html>`
}

function downloadTxt(messages, agentName) {
  const text = messages.map(m => {
    const label = m.role === 'user' ? 'You' : agentName
    return `[${label}]\n${m.content}`
  }).join('\n\n────────────────────────────────────\n\n')

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${agentName.replace(/\s+/g, '-').toLowerCase()}-chat.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function printPdf(messages, agentName) {
  const html = buildPrintHtml(messages, agentName)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

// ── Component ───────────────────────────────────────────────────────────────
export default function ChatWindow({ filePanelOpen, onFilePanelToggle }) {
  const { chat, agents, files, auth } = useApp()
  const [showExport, setShowExport] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })
  const exportRef = useRef(null)
  const exportBtnRef = useRef(null)
  const currentAgent = agents.agents.find(a => a.id === chat.currentAgentId) || null

  async function downloadAgentFile(f) {
    const res = await fetch('/.netlify/functions/get-agent-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: currentAgent.id,
        filename: f.name,
        email: auth.user.email,
        sessionToken: auth.user.sessionToken,
        sessionExpiry: auth.user.sessionExpiry,
      }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error || 'Download failed.'); return }

    let blob
    if (f.category === 'text') {
      blob = new Blob([data.data], { type: data.mimeType || 'text/plain' })
    } else {
      const bytes = atob(data.data)
      const arr = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
      blob = new Blob([arr], { type: data.mimeType })
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = f.name
    a.click()
    URL.revokeObjectURL(url)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showExport) return
    function handler(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showExport])

  function toggleExport() {
    if (!showExport && exportBtnRef.current) {
      const rect = exportBtnRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
    setShowExport(o => !o)
  }

  function handleSend(text, attachedFiles) {
    chat.sendMessage(text, attachedFiles)
  }

  const hasMessages = chat.messages.length > 0

  return (
    <div className="chat-area">
      <div className="chat-main">
        {currentAgent && (
          <div className="chat-header">
            <div className="chat-header-info">
              <span className="chat-header-icon">{currentAgent.icon || '🤖'}</span>
              <div className="chat-header-text">
                <div className="chat-header-name">{currentAgent.name}</div>
                {currentAgent.desc && (
                  <div className="chat-header-desc">{currentAgent.desc}</div>
                )}
              </div>
            </div>
            <div className="chat-header-actions">
              {hasMessages && (
                <div className="export-wrap" ref={exportRef}>
                  <button
                    ref={exportBtnRef}
                    className="btn btn-ghost chat-action-btn"
                    onClick={toggleExport}
                  >
                    ↓ Export
                  </button>
                  {showExport && (
                    <div
                      className="export-dropdown"
                      style={{ top: dropdownPos.top, right: dropdownPos.right }}
                    >
                      <button className="export-item" onClick={() => { downloadTxt(chat.messages, currentAgent.name); setShowExport(false) }}>
                        <span className="export-icon">📄</span>
                        <span>
                          <div className="export-label">Text file (.txt)</div>
                          <div className="export-sub">Plain text, downloads directly</div>
                        </span>
                      </button>
                      <button className="export-item" onClick={() => { printPdf(chat.messages, currentAgent.name); setShowExport(false) }}>
                        <span className="export-icon">📑</span>
                        <span>
                          <div className="export-label">Save as PDF</div>
                          <div className="export-sub">Opens print → Save as PDF</div>
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button className="btn btn-ghost chat-action-btn" onClick={chat.newChat}>
                New chat
              </button>
            </div>
          </div>
        )}
        <MessageList
          messages={chat.messages}
          agent={currentAgent}
          isLoading={chat.isLoading}
          onChipClick={text => handleSend(text, files.resolveFromText(text))}
        />
        <MessageInput
          onSend={handleSend}
          disabled={chat.isLoading || !currentAgent}
          files={files.files}
          resolveFromText={files.resolveFromText}
        />
      </div>
      <FilePanel
        files={files.files}
        uploadError={files.uploadError}
        addFiles={files.addFiles}
        removeFile={files.removeFile}
        togglePin={files.togglePin}
        isOpen={filePanelOpen}
        onToggle={onFilePanelToggle}
        agentFiles={currentAgent?.agentFiles || []}
        onDownloadAgentFile={downloadAgentFile}
      />
    </div>
  )
}
