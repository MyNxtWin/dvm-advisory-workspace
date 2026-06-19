import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import LoginForm from './components/Auth/LoginForm'
import OTPForm from './components/Auth/OTPForm'
import WorkspacePage from './pages/WorkspacePage'
import AdminPage from './pages/AdminPage'

function AuthGate() {
  const { auth } = useApp()

  if (!auth.user) {
    return (
      <div className="auth-page">
        {auth.step === 'email'
          ? <LoginForm auth={auth} />
          : <OTPForm auth={auth} />}
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<WorkspacePage />} />
      <Route path="/admin" element={auth.user.isAdmin ? <AdminPage /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AuthGate />
    </AppProvider>
  )
}
