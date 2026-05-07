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
  const [showAuthChoice, setShowAuthChoice] = useState(false)

  const hasAnomalies = result.has_anomalies
  const isFinished = result.is_analysis_complete

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
    
    setLoading(true)
    setError('')
    try {
      // Try to load detailed directly first (in case they already paid for this folder)
      const res = await scanAPI.getResult(result.id)
      setDetailedData(res.data)
      setShowDetailed(true)
    } catch (err) {
      if (err.response?.status === 403) {
        // Not paid for this identity or global access expired
        try {
          const successUrl = `${window.location.origin}/?payment_success=1`
          const cancelUrl = window.location.href
          const res = await billingAPI.createCheckout(successUrl, cancelUrl, result.id)
          window.location.href = res.data.url
          return; // Redirecting
        } catch (payErr) {
          setError(payErr.response?.data?.detail || 'Impossible de créer la session de paiement.');
        }
      } else {
        setError('Impossible de charger le rapport. Veuillez réessayer.');
      }
    } finally {
      setLoading(false)
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

            {/* ─── État dynamique d'avancement ─── */}
            {!isFinished ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
                padding: '48px 24px', textAlign: 'center'
              }}>
                <div className="spinner" />
                <div>
                  <div className="verdict-label" style={{ color: 'var(--primary-light)', marginBottom: 8 }}>Analyse en cours…</div>
                  <h2 className="verdict-title" style={{ fontSize: 24, marginBottom: 12 }}>Document reçu — Audit en traitement</h2>
                  <p className="verdict-subtitle" style={{ maxWidth: 460, margin: '0 auto' }}>
                    Notre système d'expertise analyse votre relevé ligne par ligne. 
                    Ce diagnostic approfondi peut prendre <strong>jusqu'à 90 secondes</strong> pour les documents scannés.
                  </p>
                </div>
                
                <div style={{ marginTop: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => refreshResult()}
                    disabled={isRefreshing}
                    style={{ fontSize: 13 }}
                  >
                    {isRefreshing ? '⌛ Vérification...' : '🔄 Vérifier l\'avancement'}
                  </button>
                </div>
              </div>
            ) : (
              /* ─── Résultat final : analyse terminée ─── */
              <div style={{ padding: '32px 0' }}>
                <span className="verdict-icon">{hasAnomalies ? '⚠️' : '✅'}</span>
                <div className="verdict-label">Expertise de carrière terminée</div>
                {result.identity_name && result.identity_name !== 'Inconnu' && (
                  <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: 'var(--text-subtle)' }}>
                     📁 Dossier : {result.identity_name} {result.identity_birth_date !== '00/00/0000' ? `(né le ${result.identity_birth_date})` : ''}
                  </div>
                )}
                <h2 className={`verdict-title ${hasAnomalies ? 'danger' : 'success'}`} style={{ marginTop: 8 }}>
                  Anomalies détectées : {hasAnomalies ? 'OUI' : 'NON'}
                </h2>
                
                {/* Reliability Score Gauge */}
                <div style={{ marginTop: 20, marginBottom: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ position: 'relative', width: 140, height: 140 }}>
                    <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={result.reliability_score > 80 ? '#22c55e' : (result.reliability_score > 50 ? '#eab308' : '#ef4444')}
                        strokeWidth="3"
                        strokeDasharray={`${result.reliability_score || 0}, 100`}
                        style={{ transition: 'stroke-dasharray 1s ease-out' }}
                      />
                    </svg>
                    <div style={{
                      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 900 }}>{result.reliability_score || 0}%</div>
                      <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase' }}>Fiabilité</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                    Score basé sur la cohérence des points Agirc-Arrco déclarés.
                  </p>
                </div>

                <p className="verdict-subtitle" style={{ marginBottom: 0 }}>
                  {hasAnomalies
                    ? 'Le système d’audit a identifié des incohérences nécessitant une régularisation pour garantir vos droits à la retraite.'
                    : 'Félicitations ! Aucune anomalie majeure n’a été détectée par notre expertise.'}
                </p>
              </div>
            )}
          </div>
          
          {hasAnomalies && isFinished && result.preview_anomalies && result.preview_anomalies.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div className="anomaly-list">
                <motion.div 
                  className="anomaly-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--primary-light)', marginBottom: 6, letterSpacing: 0.5 }}>
                    ANOMALIE {result.preview_anomalies[0].year || 'IDENTIFIÉE'}
                  </div>
                  <h4 style={{ fontSize: 15, marginBottom: 8 }}>{result.preview_anomalies[0].title}</h4>
                  
                  {/* Quarters and Points Display */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                    <div style={{ fontSize: 12, background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Trimestres validés :</span> <strong>{result.preview_anomalies[0].trimestres_valides ?? '—'}</strong>
                    </div>
                    {result.preview_anomalies[0].points_complementaires > 0 && (
                      <div style={{ fontSize: 12, background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Points retraite :</span> <strong>{result.preview_anomalies[0].points_complementaires}</strong>
                      </div>
                    )}
                  </div>

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
                      ANOMALIE {result.preview_anomalies[1].year || 'IDENTIFIÉE'}
                    </div>
                    <h4 style={{ fontSize: 15, marginBottom: 8 }}>{result.preview_anomalies[1].title}</h4>
                    
                    {/* Quarters and Points Display */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                      <div style={{ fontSize: 12, background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Trimestres validés :</span> <strong>{result.preview_anomalies[1].trimestres_valides ?? '—'}</strong>
                      </div>
                      {result.preview_anomalies[1].points_complementaires > 0 && (
                        <div style={{ fontSize: 12, background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Points retraite :</span> <strong>{result.preview_anomalies[1].points_complementaires}</strong>
                        </div>
                      )}
                    </div>

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
                  <h4 style={{ marginBottom: 8 }}>Audit approfondi de carrière en cours</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                    Votre document étant un scan, notre système d'expertise traite chaque ligne individuellement.
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

          {hasAnomalies && isFinished && (
            <div className="cta-box shadow-glow">
              <div style={{ display: 'inline-block', padding: '12px', borderRadius: '50%', background: 'rgba(79,70,229,0.1)', marginBottom: 16 }}>
                <span style={{ fontSize: 32 }}>📑</span>
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Votre dossier de régularisation prêt en un clic</h3>
              <p style={{ fontSize: 16, lineHeight: 1.5, marginBottom: 24 }}>
                Le rapport détaillé vous donne la <strong>liste exhaustive</strong> des pièces à fournir pour chaque année en anomalie selon votre situation (salarié, indépendant, étranger, etc).
              </p>
              
              <div style={{ position: 'relative', display: 'inline-block', textAlign: 'center', marginBottom: 32 }}>
                 <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, marginBottom: 12 }}>
                   ✓ Analyse standard : réalisée (gratuite)
                 </div>
                 <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 4 }}>Rapport détaillé :</div>
                 <span className="cta-price" style={{ fontSize: 56 }}>29€</span>
              </div>
              
              <div className="cta-price-label">Accès illimité à vie · Rapport exportable Word</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, maxWidth: 400, margin: '8px auto 24px' }}>
                Tarif réservé exclusivement aux particuliers. <strong>Professionnels :</strong> ce tarif ne s'applique pas à votre situation, merci de contacter Hologram Conseils.
              </p>

              {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

              {user?.has_paid_access || user?.is_admin ? (
                <button className="btn btn-primary btn-large btn-glow" onClick={loadDetailed} disabled={loading}>
                  {loading ? 'Chargement en cours…' : '📋 Accéder à mon rapport expert'}
                </button>
              ) : !user ? (
                !showAuthChoice ? (
                  <button 
                    className="btn btn-primary btn-large btn-glow" 
                    onClick={() => setShowAuthChoice(true)}
                  >
                    Se connecter ou créer mon compte pour débloquer (29€)
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 500, margin: '0 auto' }}>
                    <button 
                      className="btn btn-secondary btn-large" 
                      style={{ flex: 1 }}
                      onClick={() => { setAuthMode('login'); setShowAuth(true); }}
                    >
                      Se connecter
                    </button>
                    <button 
                      className="btn btn-primary btn-large btn-glow" 
                      style={{ flex: 1.5 }}
                      onClick={() => { setAuthMode('register'); setShowAuth(true); }}
                    >
                      Créer mon compte et payer 29€
                    </button>
                  </div>
                )
              ) : (
                <button className="btn btn-primary btn-large btn-glow" onClick={handleGetDetailed} disabled={loading}>
                  {loading ? 'Redirection sécurisée…' : '💳 Débloquer mon expertise pour ce dossier'}
                </button>
              )}

              <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                  <span>🎧</span> Support expert (48h)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                  <span>🔒</span> Paiement Stripe
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
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
