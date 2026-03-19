import { useState, useEffect, useCallback } from 'react'
import AuthModal from '../components/AuthModal'
import DetailedResult from './DetailedResult'
import { billingAPI, scanAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { motion } from 'framer-motion'
import JustificatifsBlock from '../components/JustificatifsBlock'

export default function FreeResult({ result: initialResult, onReset }) {
  const { user } = useAuth()
  const [result, setResult] = useState(initialResult)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('register')
  const [loading, setLoading] = useState(false)
  const [showDetailed, setShowDetailed] = useState(false)
  const [detailedData, setDetailedData] = useState(null)
  const [error, setError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const hasAnomalies = result.has_anomalies
  const isFinished = result.is_ai_complete

  const refreshResult = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true)
    try {
      const res = await scanAPI.getPreview(result.id)
      setResult(res.data)
    } catch (err) {
      console.error("Failed to refresh result", err)
    } finally {
      if (!silent) setIsRefreshing(false)
    }
  }, [result.id])

  // Polling for scanned documents or ongoing audits
  useEffect(() => {
    let interval;
    const needsPolling = !isFinished && result.ocr_status !== 'failed';
    
    if (needsPolling) {
      interval = setInterval(() => {
        refreshResult(true)
      }, 7000) // Poll slightly faster for OCR feedback
    }
    return () => clearInterval(interval)
  }, [result.is_scanned, result.ocr_status, isFinished, hasAnomalies, refreshResult])

  const handleGetDetailed = async () => {
    if (!user) {
      setAuthMode('register')
      setShowAuth(true)
      return
    }
    if (user.has_paid_access || user.is_admin) {
      await loadDetailed()
    } else {
      setLoading(true)
      try {
        const successUrl = `${window.location.origin}/?payment_success=1`
        const cancelUrl = window.location.href
        const res = await billingAPI.createCheckout(successUrl, cancelUrl)
        window.location.href = res.data.url
      } catch (err) {
        const errorMsg = err.response?.data?.detail || 'Impossible de créer la session de paiement. Vérifiez votre connexion.';
        setError(errorMsg);
        setLoading(false);
      }
    }
  }

  const handleRetryOCR = async () => {
    setIsRefreshing(true)
    setError('')
    try {
      await scanAPI.retryOCR(result.id)
      // Wait a bit then poll
      setTimeout(() => refreshResult(true), 1000)
    } catch (err) {
      setError("Impossible de relancer l'OCR. Veuillez réessayer.")
    } finally {
      setIsRefreshing(false)
    }
  }

  const loadDetailed = async () => {
    setLoading(true)
    try {
      const res = await scanAPI.getResult(result.id)
      setDetailedData(res.data)
      setShowDetailed(true)
    } catch {
      setError('Impossible de charger le rapport. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  const handleAuthSuccess = async () => {
    setShowAuth(false)
    await handleGetDetailed()
  }

  if (showDetailed && detailedData) {
    return <DetailedResult result={detailedData} onReset={onReset} onRefresh={loadDetailed} />
  }

  return (
    <div className="page" style={{ paddingBottom: 100 }}>
      <div className="bg-dots" />
      <div className="container" style={{ maxWidth: 680, position: 'relative' }}>

        <div className="card shadow-expert">
          <div className="result-verdict">
            <span className="verdict-icon">{hasAnomalies ? '⚠️' : '✅'}</span>
            <div className="verdict-label">{isFinished ? 'Audit algorithmique terminé' : 'Analyse du relevé en cours'}</div>
            <div className={`verdict-title ${!isFinished ? 'muted' : 'success'}`}>
              {!isFinished ? 'Analyse en cours...' : 'Analyse terminée'}
            </div>
            
            {isFinished && (
              <div className={`verdict-title ${hasAnomalies ? 'danger' : 'success'}`} style={{ marginTop: 8, fontSize: 20 }}>
                Anomalies détectées : {hasAnomalies ? 'OUI' : 'NON'}
              </div>
            )}

            <p className="verdict-subtitle">
              {!isFinished 
                ? 'Notre algorithme d’analyse traite actuellement votre document. Les résultats définitifs apparaîtront dans quelques instants.'
                : (hasAnomalies
                  ? 'L’algorithme d’analyse a identifié des incohérences nécessitant une régularisation pour garantir vos droits à la retraite.'
                  : 'Félicitations ! Aucune anomalie majeure n’a été détectée par notre algorithme.')}
            </p>
          </div>
          
          {hasAnomalies && result.preview_anomalies && result.preview_anomalies.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div className="anomaly-list">
                <motion.div 
                  className="anomaly-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--primary-light)', marginBottom: 6, letterSpacing: 0.5 }}>
                    ANOMALIE ANCIENNE
                  </div>
                  <h4 style={{ fontSize: 15, marginBottom: 8 }}>{result.preview_anomalies[0].title}</h4>
                  <p style={{ fontSize: 13, marginBottom: 12 }}>{result.preview_anomalies[0].description}</p>
                  
                  {result.preview_anomalies[0].justificatif ? (
                    <div className="justificatif-box" style={{ borderColor: 'var(--primary-light)', padding: '16px', borderLeft: '5px solid var(--primary-light)' }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--primary-light)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
                        📄 Justificatifs
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                        {result.preview_anomalies[0].justificatif}
                      </div>
                    </div>
                  ) : (
                    result.preview_anomalies[0].needs_justificatifs && <JustificatifsBlock />
                  )}
                </motion.div>
                
                {result.preview_anomalies.length > 1 && (
                  <motion.div 
                    className="anomaly-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-light)', marginBottom: 6, letterSpacing: 0.5 }}>
                      POINT DE VIGILANCE INTERMÉDIAIRE
                    </div>
                    <h4 style={{ fontSize: 15, marginBottom: 8 }}>{result.preview_anomalies[1].title}</h4>
                    <p style={{ fontSize: 13, marginBottom: 12 }}>{result.preview_anomalies[1].description}</p>
                    
                    {result.preview_anomalies[1].justificatif ? (
                      <div className="justificatif-box" style={{ borderColor: 'var(--accent-light)', padding: '16px', borderLeft: '5px solid var(--accent-light)' }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
                          📄 Justificatifs
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                          {result.preview_anomalies[1].justificatif}
                        </div>
                      </div>
                    ) : (
                      result.preview_anomalies[1].needs_justificatifs && <JustificatifsBlock />
                    )}
                  </motion.div>
                )}
              </div>

              <motion.div 
                style={{ 
                  marginTop: 20, padding: '12px', borderRadius: 12, 
                  background: 'rgba(255,255,255,0.03)', textAlign: 'center'
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  + <strong>{Math.max(0, (result.total_anomalies || result.preview_anomalies.length) - 2)}</strong> autres anomalies identifiées dans le rapport complet
                </div>
              </motion.div>
            </div>
          )}

          {!hasAnomalies && result.is_scanned && !isFinished && (
            <motion.div 
              style={{ 
                margin: '24px 0', padding: '24px', borderRadius: 20, 
                background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)',
                textAlign: 'center', position: 'relative', overflow: 'hidden'
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {(result.ocr_status === 'processing' || result.ocr_status === 'pending') ? (
                <>
                  <div className="spinner-small" style={{ margin: '0 auto 16px' }} />
                  <h4 style={{ color: 'var(--primary-light)', marginBottom: 8 }}>Traitement OCR en cours…</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Nous convertissons votre scan en données structurées. Patientez encore quelques secondes.
                  </p>
                </>
              ) : result.ocr_status === 'failed' ? (
                <>
                  <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
                  <h4 style={{ color: 'var(--danger)', marginBottom: 8 }}>Échec du traitement OCR du PDF</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                    {result.ocr_error || "Une erreur est survenue lors de l'extraction des données."}
                  </p>
                  <button 
                    className="btn btn-primary btn-sm" 
                    onClick={handleRetryOCR}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? '⌛ Relance...' : '🔄 Re-tenter l’OCR'}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 16 }}>🔍</div>
                  <h4 style={{ marginBottom: 8 }}>Analyse algorithmique approfondie en cours</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                    Votre document étant un scan, notre algorithme expert retraite réalise une analyse ligne par ligne.
                  </p>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => refreshResult()}
                    disabled={isRefreshing}
                    style={{ fontSize: 12 }}
                  >
                    {isRefreshing ? '⌛ Vérification...' : '🔄 Actualiser le résultat'}
                  </button>
                </>
              )}
            </motion.div>
          )}

          {result.ocr_status === 'success' && !isFinished && (
             <motion.div 
               style={{ 
                 margin: '20px 0', padding: '12px', borderRadius: 12, 
                 background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
                 textAlign: 'center', color: 'var(--success)'
               }}
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
             >
               ✅ PDF traité avec succès par OCR. Finalisation de l'audit...
             </motion.div>
          )}

          {hasAnomalies && (
            <div className="cta-box shadow-glow">
              <div style={{ display: 'inline-block', padding: '12px', borderRadius: '50%', background: 'rgba(79,70,229,0.1)', marginBottom: 16 }}>
                <span style={{ fontSize: 32 }}>📑</span>
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Votre dossier de régularisation prêt en un clic</h3>
              <p style={{ fontSize: 16, lineHeight: 1.5, marginBottom: 24 }}>
                Le rapport détaillé vous donne la <strong>liste exhaustive</strong> des pièces à fournir pour chaque année en anomalie selon votre situation (salarié, indépendant, étranger, etc).
              </p>
              
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 32 }}>
                 <span className="cta-price" style={{ fontSize: 56 }}>19€</span>
              </div>
              
              <div className="cta-price-label">Accès illimité à vie · Support expert inclus</div>

              {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

              {user?.has_paid_access || user?.is_admin ? (
                <button className="btn btn-primary btn-large btn-glow" onClick={loadDetailed} disabled={loading}>
                  {loading ? 'Chargement en cours…' : '📋 Accéder à mon rapport expert'}
                </button>
              ) : (
                <button className="btn btn-primary btn-large btn-glow" onClick={handleGetDetailed} disabled={loading}>
                  {loading ? 'Redirection sécurisée…' : '💳 Débloquer mon expertise complète'}
                </button>
              )}

              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-subtle)' }}>
                  <span>🔒</span> Paiement Stripe
                </div>
                <div style={{ width: 1, height: 12, background: 'var(--border)' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-subtle)' }}>
                  <span>🤝</span> Hologram Conseils
                </div>
              </div>
            </div>
          )}

          <div className="divider" />
          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={onReset}>
              ← Retour au scanner
            </button>
          </div>
        </div>
      </div>

      {showAuth && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuth(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  )
}
