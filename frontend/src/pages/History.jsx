import { useState, useEffect } from 'react'
import { scanAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import FreeResult from './FreeResult'
import DetailedResult from './DetailedResult'

export default function History() {
  const { user } = useAuth()
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedScan, setSelectedScan] = useState(null)
  const [detailedData, setDetailedData] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(null) // scan object or null
  const navigate = useNavigate()
 
  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    loadHistory()
  }, [user])
 
  const loadHistory = async () => {
    try {
      const res = await scanAPI.listHistory()
      setScans(res.data)
    } catch (err) {
      setError('Impossible de charger l\'historique.')
    } finally {
      setLoading(false)
    }
  }
 
  const handleViewScan = (scan) => {
    navigate(`/detailed-result/${scan.id}`)
  }
 
  const handleDeleteClick = (e, scan) => {
    e.stopPropagation()
    setConfirmingDelete(scan)
  }
 
  const confirmDelete = async () => {
    if (!confirmingDelete) return
    const scanId = confirmingDelete.id
    
    try {
      await scanAPI.deleteScan(scanId)
      setScans(scans.filter(s => s.id !== scanId))
      setConfirmingDelete(null)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Erreur lors de l\'suppression.'
      alert(`Erreur: ${msg}`)
      setConfirmingDelete(null)
    }
  }

  return (
    <div className="page">
      <div className="bg-dots" />
      <div className="container" style={{ maxWidth: 800 }}>
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1 }}>Mon Historique</h1>
            <p style={{ color: 'var(--text-muted)' }}>Retrouvez toutes vos analyses passées</p>
          </div>
          <Link to="/" className="btn btn-secondary btn-sm">
            + Nouvelle analyse
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Chargement de vos analyses…</div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : scans.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>📂</span>
            <h3 style={{ marginBottom: 8 }}>Aucune analyse trouvée</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
              Vous n'avez pas encore analysé de document RIS.
            </p>
            <Link to="/" className="btn btn-primary">
              Analyser mon premier RIS
            </Link>
          </div>
        ) : (
          <div className="scan-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {scans.map((scan) => (
              <div key={scan.id} className="card scan-card" style={{ transition: 'transform 0.2s', cursor: 'pointer', position: 'relative' }} onClick={() => handleViewScan(scan)}>
                <button 
                  className="delete-scan-btn"
                  onClick={(e) => handleDeleteClick(e, scan)}
                  title="Supprimer l'analyse"
                >
                  🗑️
                </button>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, paddingRight: 40 }}>
                  <div style={{ fontSize: 24 }}>{scan.has_anomalies ? '⚠️' : '✅'}</div>
                  <div className={`badge ${scan.has_anomalies ? 'badge-danger' : 'badge-success'}`}>
                    {scan.has_anomalies ? 'Anomalies' : 'Correct'}
                  </div>
                </div>
                <h4 style={{ marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 24 }}>
                  {scan.filename}
                </h4>
                <p style={{ fontSize: 13, color: 'var(--text-subtle)', marginBottom: 16 }}>
                  Analysé le {new Date(scan.created_at).toLocaleDateString('fr-FR')} à {new Date(scan.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {scan.is_scanned && <span className="badge badge-warning">Scan</span>}
                  {!scan.is_valid_ris && !scan.is_scanned && <span className="badge badge-warning">Format ?</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmingDelete && (
        <div className="modal-overlay" onClick={() => setConfirmingDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
            <h2 style={{ marginBottom: 16 }}>Supprimer l'analyse ?</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.6 }}>
              Voulez-vous vraiment supprimer l'analyse de <strong>{confirmingDelete.filename}</strong> ? 
              Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmingDelete(null)}>Annuler</button>
              <button className="btn btn-primary" style={{ background: 'var(--danger)' }} onClick={confirmDelete}>
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
