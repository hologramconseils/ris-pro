import { useState } from 'react'
import UploadZone from '../components/UploadZone'
import AnalysisLoader from '../components/AnalysisLoader'
import FreeResult from './FreeResult'
import AuthModal from '../components/AuthModal'
import { supabase } from '../lib/supabase'
import { scanAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const FEATURES = [
  { icon: '🔍', title: 'Détection automatique', desc: 'Notre système d\'expertise analyse chaque ligne de votre RIS à la recherche d\'anomalies potentielles.' },
  { icon: '⚡', title: 'Résultat en < 5 min', desc: 'L\'analyse est ultra-rapide. Vous obtenez un diagnostic clair en moins de 5 minutes.' },
  { icon: '🔒', title: 'Données sécurisées', desc: 'Vos fichiers sont traités de façon confidentielle. Nous ne les partageons jamais.' },
  { icon: '🔍', title: 'Particuliers & Pros', desc: 'Analyse standard gratuite. 19€ pour l\'analyse détaillée par dossier pour les particuliers.' },
]

export default function LandingPage() {
  const navigate = useNavigate()
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
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `uploads/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { error: dbError } = await supabase
        .from('analyses')
        .insert([
          { 
            file_path: filePath, 
            status: 'pending',
            user_id: user?.id 
          }
        ])

      if (dbError) throw dbError

      navigate(`/diagnostic?file=${encodeURIComponent(filePath)}`)
    } catch (err) {
      console.error("Erreur d'upload :", err)
      setError('Une erreur est survenue lors de l\'upload du fichier. Veuillez réessayer.')
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
          <a 
            href="https://hologramconseils.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hero-eyebrow"
          >
            Visiter Hologram Conseils
          </a>
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
            Analyse standard : gratuite · Analyse détaillée : 19€ par dossier (particuliers uniquement) · Accès à vie · Pros : contactez Hologram Conseils
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
          <div className="trust-item"><span>⚡</span> Résultat en &lt; 5 min</div>
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
