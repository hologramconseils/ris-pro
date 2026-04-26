import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sun, Moon, Monitor, Menu, X } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { supabase } from '../lib/supabase'

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
    setIsMenuOpen(false);
  };

  return (
    <header className="glass" style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <div className="container flex items-center justify-between" style={{ height: '70px' }}>
        <Link to="/" className="flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
          <img src="/logo.png" alt="Hologram Conseils" className="brand-logo" style={{ height: '36px', width: 'auto' }} />
          <span className="font-bold text-xl tracking-tight mobile-text-lg">RIS Pro</span>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex gap-4 items-center">
          <Link to="/" className="text-sm font-medium text-muted hover:text-main">Accueil</Link>
          <a href="https://hologramconseils.com" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-muted hover:text-main">
            Hologram Conseils
          </a>
          <div className="h-4 w-px bg-border mx-1" />
          
          {user ? (
            <button 
              className="text-sm font-medium text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
              onClick={handleLogout}
            >
              Se déconnecter
            </button>
          ) : (
            <Link to="/login" className="text-sm font-medium text-primary hover:underline">
              Se connecter
            </Link>
          )}

          <ThemeToggle />
        </nav>

        {/* Mobile Toggle Button */}
        <div className="md:hidden flex items-center gap-3">
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-main" aria-label="Menu">
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-[70px] left-0 w-full bg-page border-b border-border shadow-lg p-6 flex flex-col gap-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Navigation</span>
            <ThemeToggle />
          </div>
          
          <div className="flex flex-col gap-4">
            <Link to="/" onClick={() => setIsMenuOpen(false)} className="text-base font-medium text-main hover:text-primary mobile-text-sm">Accueil</Link>
            <a href="https://hologramconseils.com" target="_blank" rel="noopener noreferrer" className="text-base font-medium text-main hover:text-primary mobile-text-sm">
              Hologram Conseils
            </a>
          </div>

          <div className="h-px w-full bg-border" />
          
          {user ? (
            <button 
              className="text-base font-medium text-primary text-left cursor-pointer bg-transparent border-none p-0 mobile-text-sm"
              onClick={handleLogout}
            >
              Se déconnecter
            </button>
          ) : (
            <Link to="/login" onClick={() => setIsMenuOpen(false)} className="text-base font-medium text-primary mobile-text-sm">
              Se connecter
            </Link>
          )}
        </div>
      )}
    </header>
  )
}
