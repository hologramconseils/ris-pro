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
  const [hasAttemptedAgent, setHasAttemptedAgent] = useState(false)

  useEffect(() => {
    if (filePath) {
      fetchAnalysis(filePath)
    }

    // Polling automatique pour gérer la latence du webhook de paiement
    if (isSuccess && user && profile && profile.analysis_credits === 0) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts += 1;
        refreshProfile();
        if (attempts >= 6) {
          clearInterval(interval);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [filePath, isSuccess, user, profile?.analysis_credits])

  // Déclencher l'analyse de l'agent patrimonial IA si nécessaire
  const triggerAgentAnalysis = async (path) => {
    if (hasAttemptedAgent || agentLoading) return;
    try {
      setAgentLoading(true);
      setHasAttemptedAgent(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch('/api/analyse-patrimoniale', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ filePath: path })
      });
      if (response.ok) {
        const agentData = await response.json();
        setResults(prev => {
          const enriched = { ...prev, ...agentData };
          sessionStorage.setItem(`ris_pro_analysis_${path}`, JSON.stringify(enriched));
          
          // Sauvegarder les résultats enrichis dans la base de données
          supabase.from('analyses')
            .update({ results: enriched })
            .ilike('file_path', path)
            .then(({ error }) => {
              if (error) console.error("Erreur mise à jour DB:", error.message);
            });

          return enriched;
        });
      } else {
        console.error("L'API d'analyse patrimoniale a renvoyé une erreur:", response.status);
      }
    } catch (err) {
      console.error("Erreur de l'agent patrimonial:", err);
    } finally {
      setAgentLoading(false);
    }
  }

  // Activer l'agent si on a accès premium et que les stratégies ne sont pas encore calculées, ou s'il manque les champs de cohérence de trimestres
  useEffect(() => {
    if (authLoading) return;
    const isPremium = profile?.role === 'admin' || isMock || profile?.is_paid || (profile?.analysis_credits > 0) || isSuccess;
    if (results && isPremium && (!results.strategies || typeof results.trimestres_valides !== 'number') && !agentLoading && !hasAttemptedAgent && filePath) {
      triggerAgentAnalysis(filePath);
    }
  }, [results, profile, isSuccess, filePath, agentLoading, hasAttemptedAgent, authLoading])

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
        .ilike('file_path', path)
        .order('created_at', { ascending: false })
        .limit(1)

      if (dbError) throw dbError
      if (data && data.length > 0 && data[0].results) {
        // Associer l'analyse au compte utilisateur s'il était déconnecté lors de la soumission
        if (!data[0].user_id && user?.id) {
          try {
            await supabase.from('analyses').update({ user_id: user.id }).ilike('file_path', path);
          } catch (e) {
            console.error("Erreur lors de l'association de l'analyse au compte:", e);
          }
        }
        setResults(data[0].results)
      } else if (isMock) {
        // Fallback mock pour les tests E2E locaux
        const mockBaseResults = {
          file_path: path,
          status: 'completed',
          trimestres_valides: 136,
          trimestres_requis: 172,
          anomalies: [
            {
              id: 'anom_1',
              year: '2005',
              employer: 'ACME Corp',
              severity: 'high',
              salary: '12 400 €',
              trimesters: 0,
              points: 0,
              reason: 'Aucun trimestre validé sur cette année de transition.',
              solution: "Demander une régularisation de vos trimestres auprès de l'assurance retraite.",
              docs: ['Fiches de paie 2005', 'Contrat de travail']
            },
            {
              id: 'anom_2',
              year: '2012',
              employer: 'Sarkozy & Cie',
              severity: 'medium',
              salary: '24 500 €',
              trimesters: 2,
              points: 45,
              reason: 'Le salaire reporté est inférieur au salaire réel de vos fiches de paie.',
              solution: 'Fournir vos fiches de paie de 2012 pour mettre à jour le salaire annuel moyen.',
              docs: ['Fiches de paie de l\'année 2012 complète']
            }
          ]
        };
        setResults(mockBaseResults);
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

  // Polling / attente intermédiaire si retour de paiement réussi mais profil non mis à jour
  const waitingForPayment = isSuccess && profile && profile.analysis_credits === 0 && !isMock && profile?.role !== 'admin'

  if (waitingForPayment) {
    return (
      <div className="container flex flex-col items-center justify-center gap-6" style={{ minHeight: '60vh', padding: '4rem 1.5rem', textAlign: 'center' }}>
        <Loader2 className="animate-spin text-primary mx-auto mb-4" size={48} />
        <h1 className="text-2xl font-bold">Validation de votre paiement...</h1>
        <p className="text-muted max-w-lg">
          Nous préparons votre espace Premium. Cette opération prend généralement quelques secondes.
        </p>
      </div>
    )
  }

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

  const extractTrimestres = (text) => {
    if (typeof results.trimestres_valides === 'number') {
      return {
        valides: results.trimestres_valides,
        requis: typeof results.trimestres_requis === 'number' ? results.trimestres_requis : 172
      };
    }
    if (!text) return { valides: 72, requis: 172 };
    // Détection regex améliorée pour les rapports historiques
    const match = text.match(/(\d+)\s+trimestres?\s+enregistrés?\s+sur\s+les\s+(\d+)/i) ||
                  text.match(/(\d+)\s+trimestres?\s+validés/i) ||
                  text.match(/trimestres?\s+validés?\s*\((\d+)/i) ||
                  text.match(/(\d+)\s+trimestres/i);
    if (match) {
      const val = parseInt(match[1] || match[2]);
      const req = match[2] && match[1] !== match[2] ? parseInt(match[2]) : 172;
      return { valides: val, requis: req };
    }
    return { valides: 72, requis: 172 };
  }

  const trimestresInfo = extractTrimestres(results.synthese_situation || "");
  const careerScore = Math.round((trimestresInfo.valides / trimestresInfo.requis) * 100);
  const agentFailed = hasAttemptedAgent && !agentLoading && (!results || !results.strategies || results.strategies.length === 0);

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

        {/* Executive KPI Dashboard */}
        <div className="synthesis-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', display: 'grid' }}>
          {/* Card 1: Annulation Décote */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'space-between' }}>
            <div>
              <div className="text-xs text-muted uppercase tracking-wider font-bold">Annulation Décote</div>
              <div className="text-3xl font-extrabold" style={{ color: 'var(--primary)', margin: '0.25rem 0' }}>
                67 ans
              </div>
            </div>
            <div className="text-xs text-muted">Taux plein automatique sans décote.</div>
          </div>

          {/* Card 2: Career Completion Score */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'space-between' }}>
            <div>
              <div className="text-xs text-muted uppercase tracking-wider font-bold">Score de Carrière</div>
              <div className="text-3xl font-extrabold" style={{ color: careerScore > 80 ? 'var(--success)' : careerScore > 50 ? 'var(--warning)' : 'var(--error)', margin: '0.25rem 0' }}>
                {careerScore}%
              </div>
            </div>
            {/* Progress Bar */}
            <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${careerScore}%`, height: '100%', background: careerScore > 80 ? 'var(--success)' : careerScore > 50 ? 'var(--warning)' : 'var(--error)', borderRadius: '3px', transition: 'width 1s ease-out' }}></div>
            </div>
          </div>

          {/* Card 3: Trimestres Cotisés */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'space-between' }}>
            <div>
              <div className="text-xs text-muted uppercase tracking-wider font-bold">Trimestres Validés</div>
              {agentLoading ? (
                <div className="flex items-center gap-1.5 text-warning font-semibold text-sm" style={{ margin: '0.5rem 0', minHeight: '36px' }}>
                  <Loader2 size={16} className="animate-spin" />
                  <span>⏳ Analyse du relevé en cours...</span>
                </div>
              ) : (
                <div className="text-3xl font-extrabold" style={{ margin: '0.25rem 0' }}>
                  {trimestresInfo.valides} <span className="text-sm text-muted font-normal">/ {trimestresInfo.requis}</span>
                </div>
              )}
            </div>
            <div className="text-xs text-muted">
              {agentLoading ? "Mise à jour imminente..." : "Trimestres requis pour taux plein."}
            </div>
          </div>

          {/* Card 4: Anomalies Détectées */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'space-between' }}>
            <div>
              <div className="text-xs text-muted uppercase tracking-wider font-bold">Qualité du Dossier</div>
              <div className="text-3xl font-extrabold" style={{ color: anomalies.length > 3 ? 'var(--error)' : anomalies.length > 0 ? 'var(--warning)' : 'var(--success)', margin: '0.25rem 0' }}>
                {anomalies.length > 3 ? "Critique" : anomalies.length > 0 ? "À optimiser" : "Excellent"}
              </div>
            </div>
            <div className="text-xs text-muted">{anomalies.length} anomalie{anomalies.length > 1 ? 's' : ''} détectée{anomalies.length > 1 ? 's' : ''}.</div>
          </div>
        </div>

        {/* En-tête de chargement de l'agent si en cours */}
        {agentLoading && (
          <div className="card glass animate-pulse" style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--primary)' }}>
            <Loader2 size={36} className="animate-spin text-primary mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-1">Génération de votre Bilan Retraite...</h3>
            <p className="text-sm text-muted">Notre conseiller expert analyse vos opportunités réglementaires et rédige votre bilan.</p>
          </div>
        )}

        {/* Rapport de Conseil Patrimonial Premium */}
        {(results.strategies || agentLoading || agentFailed) && (
          <div className="flex flex-col gap-6" style={{ 
            borderBottom: '2px solid rgba(0,0,0,0.05)', 
            paddingBottom: '3rem',
            opacity: agentLoading ? 0.6 : 1,
            transition: 'opacity 0.3s ease'
          }}>
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
              <Award className="text-primary" />
              Bilan Retraite
            </h2>
 
            {agentFailed ? (
              <div className="card text-center p-8" style={{ border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.02)', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', borderRadius: '16px' }}>
                <AlertTriangle size={48} className="text-error" style={{ color: 'var(--error)' }} />
                <div>
                  <h3 className="font-bold text-lg mb-1">Échec de la génération des conseils</h3>
                  <p className="text-sm text-muted">Nous n'avons pas pu charger l'analyse personnalisée de l'IA (le service est peut-être temporairement surchargé).</p>
                </div>
                <button 
                  onClick={() => {
                    setHasAttemptedAgent(false);
                  }} 
                  className="btn btn-primary"
                  style={{ minHeight: '44px', padding: '0.6rem 1.5rem' }}
                >
                  Générer à nouveau mes préconisations
                </button>
              </div>
            ) : (
              <>
                {/* Synthèse de Situation */}
                <div className="card" style={{ 
                  padding: '2rem', 
                  borderLeft: '4px solid var(--primary)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1rem',
                  background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(37, 99, 235, 0.02) 100%)'
                }}>
                  <h3 className="text-base font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--primary)' }}>
                    <Sparkles size={18} />
                    Synthèse Globale de Situation
                  </h3>
                  <p className="text-sm text-muted leading-relaxed" style={{ fontSize: '0.95rem', lineHeight: '1.75' }}>
                    {agentLoading 
                      ? "🔍 L'expert RIS Pro croise vos données pour identifier les anomalies de votre historique de carrière..." 
                      : results.synthese_situation}
                  </p>
                </div>
     
                {/* Stratégies recommandées */}
                <div className="mt-4">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <TrendingUp size={18} className="text-success" />
                    Stratégies d'Optimisation Préconisées
                  </h3>
                  
                  {agentLoading ? (
                    <div className="synthesis-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', display: 'grid' }}>
                      {[1, 2, 3].map((idx) => (
                        <div key={idx} className="card glass animate-pulse" style={{ padding: '2rem 1.75rem', minHeight: '160px', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid rgba(0, 0, 0, 0.06)', borderRadius: '16px', background: 'var(--bg-card)' }}>
                          <div style={{ width: '40%', height: '16px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}></div>
                          <div style={{ width: '70%', height: '20px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}></div>
                          <div style={{ width: '100%', height: '14px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="synthesis-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', display: 'grid' }}>
                      {results.strategies && results.strategies.map((strat, sIdx) => (
                        <div 
                          key={sIdx} 
                          className="card glass-hover" 
                          style={{ 
                            padding: '2rem 1.75rem', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '1rem', 
                            position: 'relative', 
                            overflow: 'hidden',
                            border: '1px solid rgba(0, 0, 0, 0.06)',
                            borderRadius: '16px',
                            background: 'var(--bg-card)',
                            transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                          }}
                        >
                          {/* Watermark Number */}
                          <div style={{
                            position: 'absolute',
                            right: '1.25rem',
                            bottom: '0.25rem',
                            fontSize: '4.5rem',
                            fontWeight: '900',
                            lineHeight: '1',
                            opacity: '0.06',
                            userSelect: 'none',
                            color: 'var(--text-main)',
                            fontFamily: '"Outfit", sans-serif'
                          }}>
                            0{sIdx + 1}
                          </div>
     
                          <div className="badge" style={{
                            background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.08) 0%, rgba(22, 163, 74, 0.03) 100%)',
                            color: 'var(--success)',
                            border: '1px solid rgba(22, 163, 74, 0.15)',
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            alignSelf: 'flex-start',
                            width: 'fit-content',
                            borderRadius: '8px',
                            letterSpacing: '0.03em'
                          }}>
                            IMPACT : {strat.impact_estime}
                          </div>
                          
                          <h4 className="font-bold text-lg mt-1" style={{ letterSpacing: '-0.02em', color: 'var(--text-main)', paddingRight: '2rem' }}>
                            {strat.titre}
                          </h4>
                          
                          <p className="text-sm text-muted leading-relaxed" style={{ flex: 1, zIndex: 1, color: 'var(--text-muted)' }}>
                            {strat.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
     
                {/* Commentaire de conseil CGP */}
                <div className="mt-4 cgp-recommendation" style={{
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
                    {agentLoading 
                      ? "Rédigé de manière bienveillante et professionnelle par le conseiller expert..."
                      : `"${results.commentaire_conseil}"`}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Anomalies Details */}
        <div className="flex flex-col gap-6 mt-4 anomaly-section">
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
                <div style={{ padding: '1.5rem', background: 'var(--bg-card-hover)', borderBottom: '1px solid rgba(0,0,0,0.05)' }} className="anomaly-card-header flex justify-between items-center flex-wrap gap-4">
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
                  
                  <div className="anomaly-action-box" style={{ background: 'var(--success-bg)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(22, 163, 74, 0.2)' }}>
                    <h4 className="font-semibold flex items-center gap-2 text-success mb-2">
                      <CheckCircle2 size={16} /> Action requise
                    </h4>
                    <p className="text-sm font-medium mb-4">{anom.solution}</p>
                    
                    <div className="text-sm font-bold uppercase tracking-wider text-success mb-2" style={{ opacity: 0.8 }}>Pièces justificatives à fournir :</div>
                    <ul className="anomaly-docs-list" style={{ listStyleType: 'disc', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
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
