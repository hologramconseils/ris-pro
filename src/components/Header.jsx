import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Sun, Moon, Monitor } from 'lucide-react'

function ThemeToggle() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system')

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  return (
    <button onClick={cycleTheme} className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={`Thème: ${theme}`}>
      {theme === 'light' && <Sun size={18} />}
      {theme === 'dark' && <Moon size={18} />}
      {theme === 'system' && <Monitor size={18} />}
    </button>
  )
}

export default function Header() {
  return (
    <header className="glass" style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <div className="container flex items-center justify-between" style={{ height: '70px' }}>
        <Link to="/" className="flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
          <img src="/logo.png" alt="Hologram Conseils" className="brand-logo" style={{ height: '36px', width: 'auto' }} />
          <span className="font-bold text-xl tracking-tight">RIS Pro</span>
        </Link>
        <nav className="flex gap-4 items-center">
          <Link to="/" className="text-sm font-medium text-muted hover:text-main">Accueil</Link>
          <a href="https://hologramconseils.com" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-muted hover:text-main">
            Hologram Conseils
          </a>
          <div className="h-4 w-px bg-border mx-1" />
          {localStorage.getItem('isAdmin') === 'true' ? (
            <button 
              className="text-xs font-bold text-success flex items-center gap-1 border border-success/30 px-2 py-1 rounded"
              onClick={() => { localStorage.removeItem('isAdmin'); window.location.reload(); }}
            >
              Mode Admin (Déconnexion)
            </button>
          ) : (
            <Link to="/login" className="text-sm font-medium text-primary hover:underline">Admin</Link>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
