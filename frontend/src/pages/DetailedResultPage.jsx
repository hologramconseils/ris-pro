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

  if (loading || !result) {
    return (
      <div className="page">
        <div className="bg-dots" />
        <div className="container" style={{ maxWidth: 580, position: 'relative' }}>
          <AnalysisLoader />
          <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)' }}>
            {error ? error : "Chargement de votre rapport détaillé..."}
          </p>
          {error && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => navigate('/')}>
                Retour à l'accueil
              </button>
            </div>
          )}
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
