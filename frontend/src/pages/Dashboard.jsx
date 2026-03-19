import { useState, useEffect } from 'react'
import { scanAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import UploadZone from '../components/UploadZone'
import AnalysisLoader from '../components/AnalysisLoader'

export default function Dashboard() {
  const { user } = useAuth()
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    loadData()
    
    // Polling for active analyses
    const interval = setInterval(() => {
      checkForUpdates()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [user])

  const loadData = async () => {
    try {
      const res = await scanAPI.listHistory()
      setScans(res.data)
    } catch (err) {
      setError('Impossible de charger vos analyses.')
    } finally {
      setLoading(false)
    }
  }

  const checkForUpdates = async () => {
    // Only poll if there are pending or processing scans
    const hasActive = scans.some(s => s.ocr_status === 'pending' || s.ocr_status === 'processing')
    if (!hasActive && scans.length > 0) return

    try {
      const res = await scanAPI.listHistory()
      setScans(res.data)
    } catch (err) {
      console.error('Polling error:', err)
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) return
    setIsUploading(true)
    try {
      await scanAPI.upload(uploadFile)
      setUploadFile(null)
      loadData()
    } catch (err) {
      alert("Erreur lors de l'envoi du fichier.")
    } finally {
      setIsUploading(false)
    }
  }

  const lastSuccess = scans.find(s => s.ocr_status === 'success')

  return (
    <div className="page">
      <div className="bg-dots" />
      <div className="container" style={{ maxWidth: 1000 }}>
        
        {/* Header Summary */}
        <div style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 8, letterSpacing: '-1.5px' }}>
              Tableau de bord
            </h1>
            {lastSuccess ? (
              <p style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>✅</span>
                Dernière analyse réussie le {new Date(lastSuccess.created_at).toLocaleDateString('fr-FR')} à {new Date(lastSuccess.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Prêt pour votre première analyse RIS.</p>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
             <Link to="/history" className="btn btn-secondary">
               📂 Historique complet
             </Link>
          </div>
        </div>

        <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 30, alignItems: 'start' }}>
          
          {/* Main List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Analyses récentes</h3>
              <span className="badge badge-secondary">{scans.length} documents</span>
            </div>

            {loading ? (
              <div style={{ padding: 60, textAlign: 'center' }}>Chargement...</div>
            ) : scans.length === 0 ? (
              <div style={{ padding: 80, textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>Aucune analyse pour le moment.</p>
              </div>
            ) : (
              <div className="scan-list">
                {scans.slice(0, 5).map(scan => (
                  <div key={scan.id} 
                    className="scan-list-item" 
                    onClick={() => navigate(`/detailed-result/${scan.id}`)}
                    style={{ 
                      padding: '16px 24px', 
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ fontSize: 24 }}>
                        {scan.ocr_status === 'success' ? (scan.has_anomalies ? '⚠️' : '✅') : 
                         scan.ocr_status === 'failed' ? '❌' : '⏳'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{scan.filename}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
                          {new Date(scan.created_at).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {scan.ocr_status === 'pending' || scan.ocr_status === 'processing' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)' }}>
                          <div className="spinner-small" />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>Analyse en cours...</span>
                        </div>
                      ) : (
                        <div className={`badge ${
                          scan.ocr_status === 'success' ? (scan.has_anomalies ? 'badge-danger' : 'badge-success') : 'badge-error'
                        }`}>
                          {scan.ocr_status === 'success' ? (scan.has_anomalies ? 'Anomalies' : 'Conforme') : 'Échouée'}
                        </div>
                      )}
                      <span style={{ color: 'var(--text-subtle)' }}>→</span>
                    </div>
                  </div>
                ))}
                {scans.length > 5 && (
                  <Link to="/history" style={{ display: 'block', padding: '16px', textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>
                    Voir tout l'historique
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Side Action */}
          <div style={{ position: 'sticky', top: 100 }}>
            <div className="card" style={{ background: 'var(--card-bg-alt, rgba(255,255,255,0.03))', border: '1px dashed var(--primary)' }}>
              <h3 style={{ marginBottom: 16, fontSize: 18 }}>Nouvelle analyse</h3>
              <UploadZone onFileSelect={setUploadFile} file={uploadFile} compact />
              
              <button 
                className="btn btn-primary btn-block" 
                style={{ marginTop: 20 }}
                disabled={!uploadFile || isUploading}
                onClick={handleUpload}
              >
                {isUploading ? 'Envoi...' : '🚀 Lancer l\'analyse'}
              </button>
              
              <p style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 12, textAlign: 'center' }}>
                Le traitement IA peut prendre jusqu'à 1 minute pour les documents scannés.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
