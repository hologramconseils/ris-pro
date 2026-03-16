import { useState } from 'react'
import UploadZone from '../components/UploadZone'
import AnalysisLoader from '../components/AnalysisLoader'
import FreeResult from './FreeResult'
import AuthModal from '../components/AuthModal'
import { scanAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'

const FEATURES = [
  { icon: '🔍', title: 'Détection automatique', desc: 'Notre algorithme analyse chaque ligne de votre RIS à la recherche d\'anomalies potentielles.' },
  { icon: '⚡', title: 'Résultat en quelques secondes', desc: 'L\'analyse est ultra-rapide. Vous obtenez un diagnostic clair en moins de 10 secondes.' },
  { icon: '🔒', title: 'Données sécurisées', desc: 'Vos fichiers sont traités de façon confidentielle. Nous ne les partageons jamais.' },
  { icon: '📋', title: 'Rapport détaillé', desc: 'Accédez à une liste complète des anomalies avec des explications claires pour 19€ à vie.' },
]

export default function LandingPage() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | result | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const { user } = useAuth()

  const handleAnalyze = async () => {
    if (!file) return
    setStatus('loading')
    setError('')
    try {
      const res = await scanAPI.upload(file)
      setResult(res.data)
      setStatus('result')
    } catch (err) {
      setError('Une erreur est survenue lors de l\'analyse. Veuillez réessayer.')
      setStatus('error')
    }
  }

  const reset = () => { setFile(null); setResult(null); setStatus('idle'); setError('') }

  if (status === 'loading') {
    return (
      <div className="page">
        <div className="bg-dots" />
        <div className="container" style={{ maxWidth: 580, position: 'relative' }}>
          <AnalysisLoader />
        </div>
      </div>
    )
  }

  if (status === 'result' && result) {
    return <FreeResult result={result} onReset={reset} />
  }

  return (
    <div className="page">
      <div className="bg-dots" />
      <div className="container" style={{ position: 'relative' }}>
        {/* Hero */}
        <motion.div 
          className="hero"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="hero-eyebrow">
            <span>✦</span> Par Hologram Conseils
          </div>
          <h1>
            Analysez votre RIS,<br />
            <span>détectez les anomalies</span><br />
            en quelques secondes.
          </h1>
          <p className="hero-subtitle">
            Votre Relevé Individuel de Situation contient peut-être des erreurs qui impactent votre future retraite.
            Téléversez votre fichier et obtenez un diagnostic gratuit immédiat.
          </p>
        </motion.div>

        {/* Upload block */}
        <motion.div 
          className="card" 
          style={{ maxWidth: 640, margin: '0 auto' }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <UploadZone onFileSelect={setFile} file={file} />

          {error && (
            <div className="alert alert-error" style={{ marginTop: 16 }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-large"
              onClick={handleAnalyze}
              disabled={!file}
            >
              🔍 Analyser mon RIS gratuitement
            </button>
            {file && (
              <button className="btn btn-secondary btn-sm" onClick={reset}>
                Changer de fichier
              </button>
            )}
          </div>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-subtle)' }}>
            Analyse de base gratuite · Rapport détaillé disponible pour 19€
          </p>
        </motion.div>

        {/* Trust bar */}
        <motion.div 
          className="trust-bar"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <div className="trust-item"><span>🇫🇷</span> 100% conforme RGPD</div>
          <div className="trust-item"><span>🔒</span> Données chiffrées</div>
          <div className="trust-item"><span>⚡</span> Résultat en &lt; 10 sec</div>
          <div className="trust-item"><span>📄</span> PDF natif + OCR</div>
        </motion.div>

        {/* Features */}
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <motion.div 
              className="feature-card" 
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * i }}
            >
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}
