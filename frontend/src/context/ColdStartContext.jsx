import { createContext, useContext, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { coldStartTracker } from '../services/coldStartTracker'

export const ColdStartContext = createContext(null)

export function ColdStartProvider({ children }) {
  const [csState, setCsState] = useState(coldStartTracker.getState())

  useEffect(() => {
    return coldStartTracker.subscribe((newState) => {
      setCsState(newState)
    })
  }, [])

  return (
    <ColdStartContext.Provider value={csState}>
      {children}
    </ColdStartContext.Provider>
  )
}

export const useColdStart = () => {
  const context = useContext(ColdStartContext)
  if (!context) {
    throw new Error('useColdStart must be used within a ColdStartProvider')
  }
  return context
}

export function ColdStartLoader() {
  const { isColdStarting, error } = useColdStart()

  if (!isColdStarting && !error) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '400px', width: '100%' }}>
          {error ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="card"
              style={{ padding: '40px', borderColor: 'rgba(239, 68, 68, 0.2)' }}
            >
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '16px', color: '#ef4444' }}>
                Oups !
              </h2>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                {error}
              </p>
              <button 
                className="btn btn-primary" 
                onClick={() => window.location.reload()}
                style={{ width: '100%' }}
              >
                Réessayer
              </button>
            </motion.div>
          ) : (
            <div className="card" style={{ padding: '40px', background: 'rgba(255,255,255,0.02)' }}>
              <div className="spinner" style={{ margin: '0 auto 24px' }} />
              <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '12px', letterSpacing: '-0.5px' }}>
                Initialisation du service…
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>
                Veuillez patienter pendant que nous préparons votre environnement.
              </p>
              <div style={{ 
                marginTop: '32px', 
                height: '4px', 
                background: 'rgba(255,255,255,0.05)', 
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <motion.div
                  animate={{ 
                    x: ['-100%', '100%'],
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity, 
                    ease: "linear" 
                  }}
                  style={{ 
                    width: '40%', 
                    height: '100%', 
                    background: 'var(--accent-primary)',
                    borderRadius: '2px'
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
