import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { scanAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import FreeResult from './FreeResult'
import AnalysisLoader from '../components/AnalysisLoader'

export default function DetailedResultPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      loadResult()
    }
  }, [id])

  const loadResult = async () => {
    setLoading(true)
    setError('')
    try {
      // Use getPreview which is public and returns standard analysis
      const res = await scanAPI.getPreview(id)
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
              Oops!
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
              {error}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => navigate('/')}>
                Retour au tableau de bord
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
            Chargement de votre rapport...
          </p>
        </div>
      </div>
    )
  }

  return (
    <FreeResult 
      result={result} 
      onReset={() => navigate('/')} 
    />
  )
}
