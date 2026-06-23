import React, { useState } from 'react'
import Header from '../components/Layout/Header'
import Sidebar from '../components/Layout/Sidebar'
import ChatWindow from '../components/Chat/ChatWindow'

export default function WorkspacePage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [filePanelOpen, setFilePanelOpen] = useState(true)

  return (
    <div className="app-layout">
      <Header onMenuClick={() => setSidebarOpen(o => !o)} />
      <div className="app-body">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <ChatWindow
          filePanelOpen={filePanelOpen}
          onFilePanelToggle={() => setFilePanelOpen(o => !o)}
        />
      </div>
    </div>
  )
}
