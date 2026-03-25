import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const STEPS = [
  { label: 'Lecture du fichier PDF…', icon: '📄' },
  { label: 'Extraction du texte (OCR si nécessaire)…', icon: '🔍' },
  { label: 'Analyse des données de carrière…', icon: '📊' },
  { label: 'Détection des anomalies…', icon: '⚠️' },
  { label: 'Génération du diagnostic expert…', icon: '⚡' },
]

export default function AnalysisLoader({ message }) {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(s => (s < STEPS.length - 1 ? s + 1 : s))
    }, 900)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div 
      className="card progress-card"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="spinner" />
      <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>
        {message || "Analyse de votre carrière..."}
      </h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 32 }}>
        Veuillez patienter, nous scrutons votre RIS ligne par ligne.
      </p>
      
      <div className="progress-steps" style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto 32px' }}>
        {STEPS.map((step, i) => (
          <motion.div
            key={i}
            className={`progress-step ${i < currentStep ? 'done' : i === currentStep ? 'active' : ''}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.2 }}
            style={{ marginBottom: 12, padding: '12px 16px', display: 'flex', alignItems: 'center' }}
          >
            <span style={{ fontSize: 18, marginRight: 12 }}>{i < currentStep ? '✅' : step.icon}</span>
            <span style={{ fontWeight: i === currentStep ? 600 : 400 }}>{step.label}</span>
          </motion.div>
        ))}
      </div>

      <div className="progress-bar-wrap" style={{ height: 8, background: 'rgba(255,255,255,0.05)' }}>
        <motion.div 
          className="progress-bar-fill" 
          initial={{ width: '0%' }}
          animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          transition={{ duration: 0.8 }}
          style={{ height: '100%', borderRadius: 4 }}
        />
      </div>
    </motion.div>
  )
}
