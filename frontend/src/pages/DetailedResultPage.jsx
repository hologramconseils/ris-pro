import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { scanAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import DetailedResult from './DetailedResult'
import AnalysisLoader from '../components/AnalysisLoader'

export default function DetailedResultPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      loadResult(true) // Initial load with full screen loader
    }
  }, [id])

  const loadResult = async (silent = false) => {
    if (!result && !silent) setLoading(true)
    setError('')
    try {
      const res = await scanAPI.getResult(id)
      setResult(res.data)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Impossible de charger le rapport.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return (
      <div className="page">
        <div className="bg-dots" />
        <div className="container" style={{ maxWidth: 500, textAlign: 'center' }}>
          <div className="card shadow-expert" style={{ padding: '40px' }}>
            <span style={{ fontSize: 64, marginBottom: 24, display: 'block' }}>🚫</span>
            <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 16, letterSpacing: -0.5 }}>
              Dossier Restreint
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
              {error.includes('payer 19€') 
                ? "L'accès aux détails de cet audit nécessite un déblocage. Vous pourrez ensuite consulter et exporter votre rapport complet."
                : error}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {error.includes('payer 19€') && (
                <button className="btn btn-primary btn-large" onClick={() => navigate('/')}>
                  Débloquer mon audit (19€)
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => navigate('/')}>
                Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading || !result) {
    return (
      <div className="page">
        <div className="bg-dots" />
        <div className="container" style={{ maxWidth: 580, position: 'relative' }}>
          <AnalysisLoader />
          <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)' }}>
            Chargement de votre rapport détaillé...
          </p>
        </div>
      </div>
    )
  }

  return (
    <DetailedResult 
      result={result} 
      onReset={() => navigate('/')} 
      onRefresh={loadResult}
    />
  )
}
