import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Download, FileText, FileSearch, HelpCircle, Loader2, Lock, Award, Sparkles, TrendingUp } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { supabase } from '../lib/supabase'
import { LABELS } from '../config/labels'

export default function Bilan() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const filePath = searchParams.get('file')
  const isSuccess = searchParams.get('success') === 'true'
  const isMock = searchParams.get('mock') === 'true'
  
  const [loading, setLoading] = useState(!!filePath)
  const [agentLoading, setAgentLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (filePath) {
      fetchAnalysis(filePath)
    }

    // Si on vient de payer mais que le profil n'est pas encore à jour (latence Webhook)
    if (isSuccess && user && profile && profile.analysis_credits === 0) {
      const timer = setTimeout(() => {
        refreshProfile()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [filePath, isSuccess, user, profile?.analysis_credits])

  // Déclencher l'analyse de l'agent patrimonial IA si nécessaire
  const triggerAgentAnalysis = async (path) => {
    try {
      setAgentLoading(true);
      const response = await fetch('/api/analyse-patrimoniale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: path })
      });
      if (response.ok) {
        const agentData = await response.json();
        setResults(prev => {
          const enriched = { ...prev, ...agentData };
          sessionStorage.setItem(`ris_pro_analysis_${path}`, JSON.stringify(enriched));
          return enriched;
        });
      }
    } catch (err) {
      console.error("Erreur de l'agent patrimonial:", err);
    } finally {
      setAgentLoading(false);
    }
  }

  // Activer l'agent si on a accès premium et que les stratégies ne sont pas encore calculées
  useEffect(() => {
    const isPremium = profile?.role === 'admin' || isMock || profile?.is_paid || (profile?.analysis_credits > 0) || isSuccess;
    if (results && isPremium && !results.strategies && !agentLoading && filePath) {
      triggerAgentAnalysis(filePath);
    }
  }, [results, profile, isSuccess, filePath, agentLoading])

  const fetchAnalysis = async (path) => {
    try {
      setLoading(true)

      const cached = sessionStorage.getItem(`ris_pro_analysis_${path}`);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        // Règle métier : Ne jamais réutiliser un résultat Freemium (is_restricted) en Premium
        if (!parsedCache.is_restricted) {
          setResults(parsedCache);
          setLoading(false);
          return;
        }
        // Si le cache est restreint, on le purge et on force le rechargement depuis la DB
        sessionStorage.removeItem(`ris_pro_analysis_${path}`);
      }

      const { data, error: dbError } = await supabase
        .from('analyses')
        .select('results, user_id')
        .eq('file_path', path)
        .order('created_at', { ascending: false })
        .limit(1)

      if (dbError) throw dbError
      if (data && data.length > 0 && data[0].results) {
        // Associer l'analyse au compte utilisateur s'il était déconnecté lors de la soumission
        if (!data[0].user_id && user?.id) {
          try {
            await supabase.from('analyses').update({ user_id: user.id }).eq('file_path', path);
          } catch (e) {
            console.error("Erreur lors de l'association de l'analyse au compte:", e);
          }
        }
        setResults(data[0].results)
      } else {
        throw new Error("Aucun résultat trouvé pour ce document.")
      }
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading && !isSuccess) {
    return (
      <div className="container flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="flex flex-col items-center gap-4 text-primary">
          <Loader2 className="animate-spin" size={32} />
          <p>{LABELS.VERIFYING_ACCESS}</p>
        </div>
      </div>
    )
  }

  // LOGIQUE D'ACCÈS : Autorisé si (Admin) OU (Mode Mock) OU (Accès payé legacy) OU (Crédits > 0) OU (Retour immédiat de paiement réussi)
  const isAuthorized = profile?.role === 'admin' || isMock || profile?.is_paid || (profile?.analysis_credits > 0) || isSuccess

  if (!isAuthorized) {
    return (
      <div className="container flex flex-col items-center justify-center gap-6" style={{ flex: 1, padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div style={{ background: 'var(--error-bg)', padding: '1rem', borderRadius: '50%', color: 'var(--error)' }}>
          <Lock size={48} />
        </div>
        <h1 className="text-3xl font-bold">Accès Restreint</h1>
        <p className="text-muted max-w-lg">
          Vous devez avoir débloqué l'accès pour consulter le bilan détaillé.
        </p>
          <div className="flex gap-4 bilan-header-actions">
            <button className="btn btn-secondary" onClick={() => refreshProfile()}>
              {LABELS.CTA_REFRESH_STATUS}
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              {LABELS.CTA_START_ANALYSIS}
            </button>
          </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: '2rem' }}>
        <Loader2 size={48} className="animate-spin text-primary" />
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">{LABELS.LOADING_REPORT}</h2>
          <p className="text-muted">Récupération des données sécurisées</p>
        </div>
      </div>
    )
  }

  if (error || !results) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem' }}>
        <div className="card glass text-center p-8">
          <AlertTriangle size={48} className="text-warning mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Erreur de récupération</h2>
          <p className="text-muted mb-6">
            {error || LABELS.ERROR_FETCH}
          </p>
          <button onClick={() => navigate('/')} className="btn btn-primary">{LABELS.CTA_RETRY}</button>
        </div>
      </div>
    )
  }

  const currentYear = new Date().getFullYear()
  const rawAnomalies = results.anomalies || []
  const anomalies = Array.isArray(rawAnomalies) 
    ? [...rawAnomalies]
        .filter(a => {
          const year = parseInt(String(a.year).match(/\d{4}/)?.[0] || '0')
          return year > 0 && year < currentYear
        })
        .sort((a, b) => {
          const yearA = parseInt(String(a.year).match(/\d{4}/)?.[0] || '0')
          const yearB = parseInt(String(b.year).match(/\d{4}/)?.[0] || '0')
          return yearA - yearB
        })
    : []

  const filteredAnomalies = anomalies.filter(anom => {
    if (filter === 'all') return true
    if (filter === 'high') return anom.severity === 'high'
    if (filter === 'medium') return anom.severity !== 'high'
    return true
  })

  return (
    <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', flex: 1 }}>
      <div className="flex flex-col gap-8" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        <div className="flex justify-between items-end flex-wrap gap-4">
          <div>
            <div className="badge badge-primary" style={{ marginBottom: '1rem', background: 'var(--primary)', color: 'white' }}>Bilan Détaillé Premium</div>
            <h1 className="text-3xl font-bold">Audit Complet de votre Carrière</h1>
            <p className="text-muted mt-2">Document analysé le {new Date().toLocaleDateString('fr-FR')}</p>
          </div>
          <div className="flex gap-3 bilan-header-actions print-hidden">
            <button 
              onClick={() => navigate('/')} 
              className="btn btn-secondary flex items-center gap-2"
              style={{ padding: '0.6rem 1.2rem', minHeight: '44px', height: 'auto' }}
            >
              <FileSearch size={18} />
              <span>Analyser un autre document</span>
            </button>
            <button 
              onClick={() => window.print()} 
              className="btn btn-primary flex items-center gap-2"
              style={{ padding: '0.6rem 1.2rem', minHeight: '44px', height: 'auto' }}
            >
              <Download size={18} />
              <span>Exporter le Bilan (PDF)</span>
            </button>
          </div>
        </div>

        {/* Synthesis Cards */}
        <div className="synthesis-grid">
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="text-sm text-muted uppercase tracking-wide font-bold">Total Anomalies</div>
            <div className="text-3xl font-bold text-error">{anomalies.length}</div>
          </div>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="text-sm text-muted uppercase tracking-wide font-bold">Années impactées</div>
            <div className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
              {[...new Set(anomalies.map(a => a.year))].length}
            </div>
          </div>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="text-sm text-muted uppercase tracking-wide font-bold">Justificatifs requis</div>
            <div className="text-3xl font-bold text-warning">
              {anomalies.reduce((acc, a) => acc + (Array.isArray(a.docs) ? a.docs.length : (a.docs ? 1 : 0)), 0)}
            </div>
          </div>
        </div>

        {/* En-tête de chargement de l'agent si en cours */}
        {agentLoading && (
          <div className="card glass animate-pulse" style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--primary)' }}>
            <Loader2 size={36} className="animate-spin text-primary mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-1">Génération de votre Bilan Patrimonial...</h3>
            <p className="text-sm text-muted">Notre agent IA analyse vos opportunités réglementaires et rédige vos conseils.</p>
          </div>
        )}

        {/* Rapport de Conseil Patrimonial Premium */}
        {results.strategies && (
          <div className="flex flex-col gap-6" style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '3rem' }}>
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
              <Award className="text-primary" />
              Bilan Patrimonial & Conseils d'Optimisation
            </h2>

            {/* Synthese & Age d'or */}
            <div className="synthesis-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', display: 'grid' }}>
              <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Sparkles size={16} className="text-primary" />
                  Âge Estimé Taux Plein
                </h3>
                <div className="text-4xl font-extrabold text-primary" style={{ margin: '0.5rem 0' }}>
                  {results.age_taux_plein_estime || "64 ans"}
                </div>
                <p className="text-xs text-muted">Estimation basée sur les trimestres validés et la réglementation 2023.</p>
              </div>

              <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-2">
                  Synthèse de Situation
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {results.synthese_situation}
                </p>
              </div>
            </div>

            {/* Stratégies recommandées */}
            <div className="mt-4">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-success" />
                Stratégies d'Optimisation Préconisées
              </h3>
              <div className="synthesis-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', display: 'grid' }}>
                {results.strategies.map((strat, sIdx) => (
                  <div key={sIdx} className="card glass-hover" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}>
                    <div className="badge badge-success" style={{
                      background: 'rgba(22, 163, 74, 0.1)',
                      color: 'var(--success)',
                      borderColor: 'transparent',
                      alignSelf: 'flex-start',
                      width: 'fit-content'
                    }}>
                      Impact : {strat.impact_estime}
                    </div>
                    <h4 className="font-bold text-base mt-1">{strat.titre}</h4>
                    <p className="text-sm text-muted leading-relaxed" style={{ flex: 1 }}>{strat.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Commentaire de conseil CGP */}
            <div className="mt-4" style={{
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.05) 0%, rgba(212, 175, 55, 0.02) 100%)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderLeft: '5px solid #d4af37',
              padding: '2rem',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <h3 className="font-bold text-base mb-2 flex items-center gap-2" style={{ color: '#b89218' }}>
                <Award size={18} />
                Recommandation Globale du Conseiller Retraite
              </h3>
              <p className="text-sm font-medium leading-relaxed italic text-muted">
                "{results.commentaire_conseil}"
              </p>
            </div>
          </div>
        )}

        {/* Anomalies Details */}
        <div className="flex flex-col gap-6 mt-4">
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '1rem' }}>
            <FileSearch className="text-primary" />
            Détail des anomalies
          </h2>

          {/* Quick Filters */}
          <div className="flex gap-2 flex-wrap mb-2 print-hidden">
            <button
              onClick={() => setFilter('all')}
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '20px', padding: '0.4rem 1rem', fontSize: '0.875rem', height: '2.25rem' }}
            >
              Toutes ({anomalies.length})
            </button>
            <button
              onClick={() => setFilter('high')}
              className={`btn btn-sm ${filter === 'high' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '20px', padding: '0.4rem 1rem', fontSize: '0.875rem', height: '2.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span>
              Critiques ({anomalies.filter(a => a.severity === 'high').length})
            </button>
            <button
              onClick={() => setFilter('medium')}
              className={`btn btn-sm ${filter === 'medium' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '20px', padding: '0.4rem 1rem', fontSize: '0.875rem', height: '2.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></span>
              Moyennes ({anomalies.filter(a => a.severity !== 'high').length})
            </button>
          </div>

          {filteredAnomalies.length === 0 ? (
            <div className="card text-center p-8 text-muted">
              Aucune anomalie de cette catégorie n'a été détectée.
            </div>
          ) : (
            filteredAnomalies.map((anom, idx) => (
              <div key={idx} className={`anomaly-card card ${anom.severity === 'high' ? 'high-severity' : ''}`} style={{ padding: '0', overflow: 'hidden', marginBottom: '2rem' }}>
                <div style={{ padding: '1.5rem', background: 'var(--bg-card-hover)', borderBottom: '1px solid rgba(0,0,0,0.05)' }} className="flex justify-between items-center flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div style={{ background: anom.severity === 'high' ? 'var(--error-bg)' : 'var(--warning-bg)', color: anom.severity === 'high' ? 'var(--error)' : 'var(--warning)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Année {anom.year} - {anom.employer}</h3>
                    </div>
                  </div>
                  <div className={`badge ${anom.severity === 'high' ? 'badge-error' : 'badge-warning'}`} style={{
                    background: anom.severity === 'high' ? 'var(--error-bg)' : 'var(--warning-bg)',
                    color: anom.severity === 'high' ? 'var(--error)' : 'var(--warning)',
                    borderColor: 'transparent'
                  }}>
                    {anom.severity === 'high' ? 'Anomalie critique' : 'Anomalie moyenne'}
                  </div>
                </div>
                
                <div style={{ padding: '1.5rem' }} className="flex flex-col gap-6">
                  <div className="details-grid">
                    <div>
                      <div className="text-xs text-muted">Salaire Brut (ou nature)</div>
                      <div className="font-semibold">{anom.salary}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Trimestres validés</div>
                      <div className="font-semibold">{anom.trimesters}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Points Validés</div>
                      <div className="font-semibold">{anom.points}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold flex items-center gap-2 text-error mb-2">
                      <AlertTriangle size={16} /> Explication de l'erreur
                    </h4>
                    <p className="text-muted">{anom.reason}</p>
                  </div>
                  
                  <div style={{ background: 'var(--success-bg)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(22, 163, 74, 0.2)' }}>
                    <h4 className="font-semibold flex items-center gap-2 text-success mb-2">
                      <CheckCircle2 size={16} /> Action requise
                    </h4>
                    <p className="text-sm font-medium mb-4">{anom.solution}</p>
                    
                    <div className="text-sm font-bold uppercase tracking-wider text-success mb-2" style={{ opacity: 0.8 }}>Pièces justificatives à fournir :</div>
                    <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      {Array.isArray(anom.docs) ? anom.docs.map((doc, docIdx) => (
                        <li key={docIdx} style={{ marginBottom: '0.25rem' }}>{doc}</li>
                      )) : (
                        <li style={{ marginBottom: '0.25rem' }}>{anom.docs || "Aucun document spécifique requis"}</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col items-center gap-4 mt-8 mb-12 print-hidden">
          <a 
            href="https://calendly.com/hologramconseils/reservez-votre-appel-strategique" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-secondary btn-cta-premium"
          >
            <span>{LABELS.CTA_CALL}</span>
          </a>
        </div>

      </div>
    </div>
  )
}
