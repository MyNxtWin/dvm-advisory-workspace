import { useState } from 'react'

const MAX_SIZE = 10 * 1024 * 1024

const MIME_CATEGORY = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'application/pdf': 'document',
  'text/plain': 'text',
  'text/csv': 'text',
  'text/markdown': 'text',
}

let _id = 0
function uid() { return ++_id }

function readAsBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => res(e.target.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

function readAsText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => res(e.target.result)
    r.onerror = rej
    r.readAsText(file)
  })
}

export function useFiles() {
  const [files, setFiles] = useState([])
  const [uploadError, setUploadError] = useState('')

  async function addFiles(fileList) {
    const errs = []
    const added = []
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_SIZE) { errs.push(`${file.name}: too large (max 10 MB)`); continue }
      const category = MIME_CATEGORY[file.type]
      if (!category) { errs.push(`${file.name}: unsupported type`); continue }
      try {
        const data = category === 'text' ? await readAsText(file) : await readAsBase64(file)
        added.push({ id: uid(), name: file.name, mimeType: file.type, category, data, size: file.size, pinned: false })
      } catch {
        errs.push(`${file.name}: failed to read`)
      }
    }
    if (added.length) setFiles(prev => [...prev, ...added])
    if (errs.length) {
      setUploadError(errs.join(' · '))
      setTimeout(() => setUploadError(''), 5000)
    }
  }

  function removeFile(id) {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  function togglePin(id) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, pinned: !f.pinned } : f))
  }

  // Returns files to attach: always includes pinned + any @mentioned unpinned files
  function resolveFromText(text) {
    const pinned = files.filter(f => f.pinned)
    if (!files.length || !text) return pinned
    const lower = text.toLowerCase()
    if (lower.includes('@all')) return files
    const pinnedIds = new Set(pinned.map(f => f.id))
    const mentioned = files.filter(f => {
      if (pinnedIds.has(f.id)) return false
      const n = f.name.toLowerCase()
      const noExt = n.replace(/\.[^.]+$/, '')
      return lower.includes(`@${n}`) || lower.includes(`@${noExt}`)
    })
    return [...pinned, ...mentioned]
  }

  return { files, uploadError, addFiles, removeFile, togglePin, resolveFromText }
}
