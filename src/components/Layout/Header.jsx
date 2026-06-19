import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import './Layout.css'

export default function Header({ onMenuClick }) {
  const { auth } = useApp()
  const { user } = auth
  const location = useLocation()
  const isAdmin = user?.isAdmin

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="sidebar-toggle" onClick={onMenuClick} aria-label="Toggle sidebar">☰</button>
        <div className="header-logo">DVM</div>
        <span className="header-title">Advisory Workspace</span>
      </div>
      <div className="header-right">
        {isAdmin && (
          <Link
            to={location.pathname === '/admin' ? '/' : '/admin'}
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
          >
            {location.pathname === '/admin' ? '← Workspace' : 'Admin Panel'}
          </Link>
        )}
        <span className="header-email">{user?.email}</span>
        {isAdmin && <span className="badge badge-admin">Admin</span>}
        <button className="btn btn-ghost" onClick={auth.logout} style={{ fontSize: 12 }}>
          Sign out
        </button>
      </div>
    </header>
  )
}
