import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-switcher" style={{ 
      display: 'flex', 
      background: 'var(--bg-card-2)', 
      padding: '4px', 
      borderRadius: '12px',
      border: '1px solid var(--border)',
      gap: '4px'
    }}>
      <button 
        onClick={() => setTheme('light')}
        className={`btn-theme ${theme === 'light' ? 'active' : ''}`}
        title="Mode Jour"
        style={{
          border: 'none',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '14px',
          cursor: 'pointer',
          background: theme === 'light' ? 'var(--primary)' : 'transparent',
          color: theme === 'light' ? '#fff' : 'var(--text-muted)',
          transition: 'all 0.2s'
        }}
      >
        ☀️
      </button>
      <button 
        onClick={() => setTheme('dark')}
        className={`btn-theme ${theme === 'dark' ? 'active' : ''}`}
        title="Mode Nuit"
        style={{
          border: 'none',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '14px',
          cursor: 'pointer',
          background: theme === 'dark' ? 'var(--primary)' : 'transparent',
          color: theme === 'dark' ? '#fff' : 'var(--text-muted)',
          transition: 'all 0.2s'
        }}
      >
        🌙
      </button>
      <button 
        onClick={() => setTheme('system')}
        className={`btn-theme ${theme === 'system' ? 'active' : ''}`}
        title="Mode Système"
        style={{
          border: 'none',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '14px',
          cursor: 'pointer',
          background: theme === 'system' ? 'var(--primary)' : 'transparent',
          color: theme === 'system' ? '#fff' : 'var(--text-muted)',
          transition: 'all 0.2s'
        }}
      >
        💻
      </button>
    </div>
  );
}
