import React from 'react'
import Header from '../components/Layout/Header'
import AdminPanel from '../components/Admin/AdminPanel'

export default function AdminPage() {
  return (
    <div className="app-layout">
      <Header />
      <AdminPanel />
    </div>
  )
}
