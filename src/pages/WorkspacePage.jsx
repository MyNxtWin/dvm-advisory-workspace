import React from 'react'
import Header from '../components/Layout/Header'
import Sidebar from '../components/Layout/Sidebar'
import ChatWindow from '../components/Chat/ChatWindow'

export default function WorkspacePage() {
  return (
    <div className="app-layout">
      <Header />
      <div className="app-body">
        <Sidebar />
        <ChatWindow />
      </div>
    </div>
  )
}
