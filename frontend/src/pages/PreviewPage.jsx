import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { scanAPI } from '../services/api'
import FreeResult from './FreeResult'

/**
 * PreviewPage — Route /preview/:id
 * Loads a scan by ID and renders the FreeResult view for non-paying users.
 * Ensures non-paying users see the free result view + CTA instead of hitting a 403.
 */
export default function PreviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await scanAPI.getPreview(id)
        setResult(res.data)
      } catch (err) {
        if (err.response?.status === 401) {
          navigate('/')
        } else {
          setError('Impossible de charger cette analyse.')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, navigate])

  const reset = () => navigate('/dashboard')

  if (loading) {
    return (
      <div className="page">
        <div className="bg-dots" />
        <div className="container" style={{ maxWidth: 580, textAlign: 'center', paddingTop: 80 }}>
          <div className="spinner" style={{ margin: '0 auto 24px' }} />
          <p style={{ color: 'var(--text-muted)' }}>Chargement de votre analyse…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 580, textAlign: 'center', paddingTop: 80 }}>
          <div className="alert alert-error">⚠️ {error}</div>
          <button className="btn btn-secondary" style={{ marginTop: 20 }} onClick={() => navigate('/dashboard')}>
            ← Retour au tableau de bord
          </button>
        </div>
      </div>
    )
  }

  if (!result) return null

  return <FreeResult result={result} onReset={reset} />
}
