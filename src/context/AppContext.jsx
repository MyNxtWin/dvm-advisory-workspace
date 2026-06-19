import React, { createContext, useContext } from 'react'
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

  return (
    <AppCtx.Provider value={{ auth, agents, chat, files }}>
      {children}
    </AppCtx.Provider>
  )
}

export function useApp() {
  return useContext(AppCtx)
}
