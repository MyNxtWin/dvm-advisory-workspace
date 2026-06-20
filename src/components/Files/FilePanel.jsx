import React, { useRef, useState } from 'react'
import './FilePanel.css'

const ICONS = { image: '🖼️', document: '📄', text: '📋' }

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FilePanel({ files, uploadError, addFiles, removeFile, togglePin, isOpen, onToggle, agentFiles, onDownloadAgentFile }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [downloading, setDownloading] = useState(null) // filename being downloaded

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  async function handleDownload(f) {
    setDownloading(f.name)
    try {
      await onDownloadAgentFile(f)
    } finally {
      setDownloading(null)
    }
  }

  const pinned = files.filter(f => f.pinned)
  const unpinned = files.filter(f => !f.pinned)
  const hasAgentFiles = agentFiles?.length > 0

  return (
    <div className={`file-panel${isOpen ? ' open' : ''}`}>
      <div className="file-panel-header">
        <span className="file-panel-title">Files</span>
        <div className="file-panel-header-actions">
          {(files.length > 0 || hasAgentFiles) && <span className="file-count">{files.length + (agentFiles?.length || 0)}</span>}
          <button className="file-panel-toggle" onClick={onToggle} title={isOpen ? 'Hide files' : 'Show files'}>
            {isOpen ? '›' : '‹'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="file-panel-body">

          {/* ── Agent reference documents ── */}
          {hasAgentFiles && (
            <div className="file-section agent-docs-section">
              <div className="file-section-label agent-docs-label">Agent Documents</div>
              {agentFiles.map(f => (
                <div key={f.name} className="file-item agent-doc-item">
                  <span className="file-icon">{ICONS[f.category] || '📎'}</span>
                  <div className="file-info">
                    <div className="file-name" title={f.name}>{f.name}</div>
                    <div className="file-size">{fmtSize(f.size)}</div>
                  </div>
                  <button
                    className="file-download-btn"
                    onClick={() => handleDownload(f)}
                    disabled={downloading === f.name}
                    title="Download"
                  >
                    {downloading === f.name ? '…' : '↓'}
                  </button>
                </div>
              ))}
              <div className="agent-docs-hint">Always included in every chat with this agent</div>
            </div>
          )}

          {/* ── Upload zone ── */}
          <div
            className={`file-drop-zone${dragging ? ' dragging' : ''}`}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
          >
            <div className="file-drop-icon">↑</div>
            <div>Drop or click to upload</div>
            <div className="file-drop-sub">PDF · Image · TXT · CSV</div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.md"
              style={{ display: 'none' }}
              onChange={e => { addFiles(e.target.files); e.target.value = '' }}
            />
          </div>

          {uploadError && <div className="file-error">{uploadError}</div>}

          {files.length === 0 && (
            <div className="file-empty">
              Upload files to attach them in chat.<br />
              Pin a file to always include it automatically.
            </div>
          )}

          {pinned.length > 0 && (
            <div className="file-section">
              <div className="file-section-label">Pinned — always attached</div>
              {pinned.map(f => (
                <FileItem key={f.id} f={f} onRemove={removeFile} onPin={togglePin} />
              ))}
            </div>
          )}

          {unpinned.length > 0 && (
            <div className="file-section">
              {pinned.length > 0 && <div className="file-section-label">Session files</div>}
              {unpinned.map(f => (
                <FileItem key={f.id} f={f} onRemove={removeFile} onPin={togglePin} />
              ))}
              <div className="file-mention-hint">Type @filename in chat to attach</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FileItem({ f, onRemove, onPin }) {
  return (
    <div className={`file-item${f.pinned ? ' pinned' : ''}`}>
      <span className="file-icon">{ICONS[f.category] || '📎'}</span>
      <div className="file-info">
        <div className="file-name" title={f.name}>{f.name}</div>
        <div className="file-size">{fmtSize(f.size)}</div>
      </div>
      <button
        className={`file-pin-btn${f.pinned ? ' active' : ''}`}
        onClick={() => onPin(f.id)}
        title={f.pinned ? 'Unpin — will need @mention' : 'Pin — always attach to every message'}
      >
        ⊙
      </button>
      <button className="file-remove" onClick={() => onRemove(f.id)} title="Remove">×</button>
    </div>
  )
}
