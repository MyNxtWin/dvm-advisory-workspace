import React, { useRef, useState } from 'react'
import './FilePanel.css'

const ICONS = { image: '🖼️', document: '📄', text: '📋' }

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FilePanel({ files, uploadError, addFiles, removeFile }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  return (
    <div className="file-panel">
      <div className="file-panel-header">
        <span>📁 Project Files</span>
        {files.length > 0 && <span className="file-count">{files.length}</span>}
      </div>

      <div
        className={`file-drop-zone${dragging ? ' dragging' : ''}`}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
      >
        <div className="file-drop-icon">📎</div>
        <div>Drop files or click to upload</div>
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

      <div className="file-list">
        {files.length === 0 && (
          <div className="file-empty">Upload files to reference them in chat using @filename</div>
        )}
        {files.map(f => (
          <div key={f.id} className="file-item">
            <span className="file-icon">{ICONS[f.category] || '📎'}</span>
            <div className="file-info">
              <div className="file-name" title={f.name}>{f.name}</div>
              <div className="file-size">{fmtSize(f.size)}</div>
            </div>
            <button className="file-remove" onClick={() => removeFile(f.id)} title="Remove">×</button>
          </div>
        ))}
      </div>

      {files.length > 0 && (
        <div className="file-hint">Type @filename or @all in chat to attach</div>
      )}
    </div>
  )
}
