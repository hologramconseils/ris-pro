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
      loadResult()
    }
  }, [id])

  const loadResult = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await scanAPI.getResult(id)
      setResult(res.data)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Impossible de charger le rapport.'
      setError(msg)
      // If unauthorized, we might stay here to show an error or redirect
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
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

  if (error) {
    return (
      <div className="page">
        <div className="bg-dots" />
        <div className="container" style={{ maxWidth: 500, textAlign: 'center' }}>
          <div className="card">
            <span style={{ fontSize: 48 }}>🚫</span>
            <h2 style={{ marginTop: 16 }}>Accès restreint</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
              {error === 'Not enough permissions' 
                ? "Vous n'avez pas encore accès à ce rapport détaillé. Veuillez procéder au paiement pour le débloquer."
                : error}
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!result) return null

  return (
    <DetailedResult 
      result={result} 
      onReset={() => navigate('/')} 
    />
  )
}
