import React, { createContext, useContext, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useChat } from '../hooks/useChat'
import { useAgents } from '../hooks/useAgents'
import { useFiles } from '../hooks/useFiles'

const AppCtx = createContext(null)

export function AppProvider({ children }) {
  const auth = useAuth()
  const agents = useAgents(auth.user)
  const files = useFiles()
  const chat = useChat(auth.user, auth.logout)

  useEffect(() => {
    if (!chat.currentAgentId && agents.agents.length > 0) {
      chat.switchAgent(agents.agents[0].id)
    }
  }, [agents.agents])

  return (
    <AppCtx.Provider value={{ auth, agents, chat, files }}>
      {children}
    </AppCtx.Provider>
  )
}

export function useApp() {
  return useContext(AppCtx)
}
