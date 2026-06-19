import React from 'react'
import { useApp } from '../../context/AppContext'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import FilePanel from '../Files/FilePanel'
import './Chat.css'

export default function ChatWindow() {
  const { chat, agents, files } = useApp()
  const currentAgent = agents.agents.find(a => a.id === chat.currentAgentId) || null

  function handleSend(text, attachedFiles) {
    chat.sendMessage(text, attachedFiles)
  }

  return (
    <div className="chat-area">
      <div className="chat-main">
        {currentAgent && (
          <div className="chat-header">
            <div className="chat-header-info">
              <span className="chat-header-icon">{currentAgent.icon || '🤖'}</span>
              <div>
                <div className="chat-header-name">{currentAgent.name}</div>
                <div className="chat-header-desc">{currentAgent.desc}</div>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={chat.newChat} style={{ fontSize: 12 }}>
              New chat
            </button>
          </div>
        )}
        <MessageList
          messages={chat.messages}
          agent={currentAgent}
          isLoading={chat.isLoading}
          onChipClick={text => handleSend(text, [])}
        />
        <MessageInput
          onSend={handleSend}
          disabled={chat.isLoading || !currentAgent}
          files={files.files}
        />
      </div>
      <FilePanel
        files={files.files}
        uploadError={files.uploadError}
        addFiles={files.addFiles}
        removeFile={files.removeFile}
      />
    </div>
  )
}
