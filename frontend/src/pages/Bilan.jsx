import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Download, FileText, FileSearch, HelpCircle, Loader2, Lock, Award, Sparkles, TrendingUp } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { supabase } from '../lib/supabase'
import { LABELS } from '../config/labels'

const renderMarkdown = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
    
    // Nettoyer les balises de mise en valeur
    let cleanLine = trimmed;
    cleanLine = cleanLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    cleanLine = cleanLine.replace(/\*/g, ''); // Enlever les astérisques restants
    
    if (cleanLine.startsWith('# ')) {
      return <h1 key={idx} className="text-3xl font-extrabold my-6 text-main print-text-black" style={{ letterSpacing: '-0.02em', borderBottom: '2px solid var(--primary)', paddingBottom: '0.5rem', fontFamily: 'var(--font-sans)' }}>{cleanLine.slice(2)}</h1>;
    }
    if (cleanLine.startsWith('## ')) {
      return <h2 key={idx} className="text-xl font-bold mt-8 mb-4 text-primary print-text-black" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem', fontFamily: 'var(--font-sans)' }}>{cleanLine.slice(3)}</h2>;
    }
    if (cleanLine.startsWith('### ')) {
      return <h3 key={idx} className="text-lg font-bold mt-6 mb-3 text-main print-text-black" style={{ fontFamily: 'var(--font-sans)' }}>{cleanLine.slice(4)}</h3>;
    }
    if (cleanLine.match(/^\d+\.\s+/)) {
      const numMatch = cleanLine.match(/^\d+\./)[0];
      const headingText = cleanLine.replace(/^\d+\.\s+/, '');
      const parts = headingText.split(/<\/?strong>/);
      return (
        <h3 key={idx} className="text-lg font-bold mt-8 mb-3 text-main print-text-black" style={{ fontFamily: 'var(--font-sans)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start', lineHeight: '1.5' }}>
          <span className="text-primary font-extrabold" style={{ flexShrink: 0, lineHeight: '1.5' }}>{numMatch}</span>
          <span style={{ flex: 1 }}>
            {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-bold text-main" style={{ color: 'var(--text-main)' }}>{part}</strong> : part)}
          </span>
        </h3>
      );
    }
    if (isBullet) {
      const bulletText = cleanLine.startsWith('- ') ? cleanLine.slice(2) : (cleanLine.startsWith(' ') ? cleanLine.trim() : cleanLine);
      const parts = bulletText.split(/<\/?strong>/);
      return (
        <div key={idx} className="text-base my-3 pl-4 border-l-2 border-primary/30" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: 'var(--text-muted)', lineHeight: '1.75', textAlign: 'left' }}>
          {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-bold text-main" style={{ color: 'var(--text-main)', fontFamily: 'var(--font-sans)' }}>{part}</strong> : part)}
        </div>
      );
    }
    if (cleanLine === '') {
      return <div key={idx} className="h-4" />;
    }
    
    // Remplacement des balises <strong> pour le gras
    const parts = cleanLine.split(/<\/?strong>/);
    if (parts.length > 1) {
      return (
        <p key={idx} className="text-base my-3 print-text-black" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: 'var(--text-muted)', lineHeight: '1.75', textAlign: 'left' }}>
          {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-bold text-main" style={{ color: 'var(--text-main)', fontFamily: 'var(--font-sans)' }}>{part}</strong> : part)}
        </p>
      );
    }
    return <p key={idx} className="text-base my-3 print-text-black" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: 'var(--text-muted)', lineHeight: '1.75', textAlign: 'left' }}>{cleanLine}</p>;
  });
}

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
  const [openAnomalyIndex, setOpenAnomalyIndex] = useState(0) // Premier accordéon ouvert par défaut
  const [openDocsIndex, setOpenDocsIndex] = useState(null) // Gestion du tiroir de justificatifs

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

  // LOGIQUE D'ACCÈS : Autorisé si (Admin) OU (Mode Mock) OU (Accès payé legacy) OU (Crédits > 0) OU (Retour immédiat de paiement réussi) OU (Résultats déjà premium/non-restreints)
  const isAuthorized = profile?.role === 'admin' || isMock || profile?.is_paid || (profile?.analysis_credits > 0) || isSuccess || (results && !results.is_restricted)

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
    if (typeof results?.trimestres_valides === 'number') {
      return {
        valides: results.trimestres_valides,
        requis: typeof results.trimestres_requis === 'number' ? results.trimestres_requis : 172
      };
    }
    if (!text) return { valides: 136, requis: 172 };
    const match = text.match(/(\d+)\s+trimestres?\s+enregistrés?\s+sur\s+les\s+(\d+)/i) ||
                  text.match(/(\d+)\s+trimestres?\s+validés/i) ||
                  text.match(/trimestres?\s+validés?\s*\((\d+)/i) ||
                  text.match(/(\d+)\s+trimestres/i);
    if (match) {
      const val = parseInt(match[1] || match[2]);
      const req = match[2] && match[1] !== match[2] ? parseInt(match[2]) : 172;
      return { valides: val, requis: req };
    }
    return { valides: 136, requis: 172 };
  }

  const trimestresInfo = extractTrimestres(results?.synthese_situation || "");
  const careerScore = Math.min(100, Math.round((trimestresInfo.valides / trimestresInfo.requis) * 100));

  const currentYear = new Date().getFullYear()
  const rawAnomalies = results?.anomalies || []
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

  const actionPlan = Array.isArray(results?.action_plan) && results.action_plan.length > 0
    ? results.action_plan
    : [
        { step: 1, title: "Rassemblement des pièces justificatives", description: "Récupérez les bulletins de paie et attestations figurant dans le détail des anomalies ci-dessus." },
        { step: 2, title: "Contestation auprès des caisses de retraite", description: "Déposez une demande de régularisation en ligne sur votre espace Info-Retraite ou par courrier recommandé." },
        { step: 3, title: "Vérification de la mise à jour de votre RIS", description: "Contrôlez l'imputation de vos nouveaux trimestres et points dans un délai de 2 à 3 mois." }
      ];

  return (
    <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', flex: 1 }}>
      <div className="flex flex-col gap-10" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* En-tête Bilan */}
        <div className="flex justify-between items-end flex-wrap gap-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '1.5rem' }}>
          <div>
            <div className="badge badge-primary" style={{ marginBottom: '0.75rem', background: 'var(--primary)', color: 'white', fontWeight: '700' }}>Bilan Détaillé Premium</div>
            <h1 className="text-3xl font-extrabold" style={{ letterSpacing: '-0.02em' }}>Audit Complet de votre Carrière</h1>
            <p className="text-muted text-sm mt-1">Édité le {new Date().toLocaleDateString('fr-FR')} par votre Conseiller Retraite RIS Pro</p>
          </div>
          <div className="flex gap-3 bilan-header-actions print-hidden">
            <button 
              onClick={() => navigate('/')} 
              className="btn btn-secondary flex items-center gap-2 text-sm"
              style={{ padding: '0.6rem 1.2rem', minHeight: '42px' }}
            >
              <FileSearch size={16} />
              <span>Autre analyse</span>
            </button>
            <button 
              onClick={() => window.print()} 
              className="btn btn-primary flex items-center gap-2 text-sm"
              style={{ padding: '0.6rem 1.2rem', minHeight: '42px' }}
            >
              <Download size={16} />
              <span>Exporter en PDF</span>
            </button>
          </div>
        </div>

        {/* SECTION 1 : SYNTHÈSE INTERACTIVE & KPI */}
        <section className="flex flex-col gap-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-main">
            <Award className="text-primary" size={22} />
            SECTION 1 — Synthèse & Chiffres Clés
          </h2>

          <div className="synthesis-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', display: 'grid' }}>
            {/* KPI 1: Age Taux Plein */}
            <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
              <div>
                <div className="text-xs text-muted uppercase tracking-wider font-bold">Âge Taux Plein</div>
                <div className="text-3xl font-extrabold" style={{ color: 'var(--primary)', margin: '0.25rem 0' }}>67 ans</div>
              </div>
              <div className="text-xs text-muted">Annulation automatique de la décote.</div>
            </div>

            {/* KPI 2: Score de Carrière */}
            <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
              <div>
                <div className="text-xs text-muted uppercase tracking-wider font-bold">Complétude Carrière</div>
                <div className="text-3xl font-extrabold" style={{ color: careerScore > 80 ? 'var(--success)' : careerScore > 50 ? 'var(--warning)' : 'var(--error)', margin: '0.25rem 0' }}>
                  {careerScore}%
                </div>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${careerScore}%`, height: '100%', background: careerScore > 80 ? 'var(--success)' : careerScore > 50 ? 'var(--warning)' : 'var(--error)', borderRadius: '3px' }}></div>
              </div>
            </div>

            {/* KPI 3: Trimestres Cotisés */}
            <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
              <div>
                <div className="text-xs text-muted uppercase tracking-wider font-bold">Trimestres Validés</div>
                <div className="text-3xl font-extrabold" style={{ margin: '0.25rem 0' }}>
                  {trimestresInfo.valides} <span className="text-sm text-muted font-normal">/ {trimestresInfo.requis}</span>
                </div>
              </div>
              <div className="text-xs text-muted">Nombre de trimestres enregistrés au RIS.</div>
            </div>

            {/* KPI 4: Anomalies */}
            <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
              <div>
                <div className="text-xs text-muted uppercase tracking-wider font-bold">Anomalies Détectées</div>
                <div className="text-3xl font-extrabold" style={{ color: anomalies.length > 3 ? 'var(--error)' : anomalies.length > 0 ? 'var(--warning)' : 'var(--success)', margin: '0.25rem 0' }}>
                  {anomalies.length}
                </div>
              </div>
              <div className="text-xs text-muted">{anomalies.length > 0 ? "Corrections requises" : "Aucune anomalie majeure"}</div>
            </div>
          </div>

          {/* Synthèse textuelle de l'expert */}
          {results?.summary && (
            <div className="card" style={{ 
              padding: '1.5rem 1.75rem', 
              borderLeft: '4px solid var(--primary)', 
              background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(37, 99, 235, 0.03) 100%)',
              lineHeight: '1.7'
            }}>
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 mb-2" style={{ color: 'var(--primary)' }}>
                <Sparkles size={16} /> Synthèse du Conseiller Retraite
              </h3>
              <p className="text-sm text-muted" style={{ margin: 0 }}>{results.summary}</p>
            </div>
          )}

          {/* Stratégies d'optimisation (si disponibles) */}
          {Array.isArray(results?.strategies) && results.strategies.length > 0 && (
            <div className="mt-2">
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <TrendingUp size={18} className="text-success" />
                Opportunités & Stratégies d'Optimisation
              </h3>
              <div className="synthesis-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', display: 'grid' }}>
                {results.strategies.map((strat, sIdx) => (
                  <div key={sIdx} className="card" style={{ padding: '1.25rem 1.5rem', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '12px', background: 'var(--bg-card)' }}>
                    <div className="badge badge-success text-xs font-bold mb-2" style={{ width: 'fit-content' }}>
                      {strat.priority ? `Priorité : ${strat.priority}` : "Opportunité"}
                    </div>
                    <h4 className="font-bold text-base mb-1" style={{ color: 'var(--text-main)' }}>{strat.title || strat.titre}</h4>
                    <p className="text-xs text-muted leading-relaxed" style={{ margin: 0 }}>{strat.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* SECTION 2 : TABLEAU DES ANOMALIES PLIABLES (ACCORDÉON) */}
        <section className="flex flex-col gap-6 mt-4">
          <div className="flex justify-between items-center flex-wrap gap-4" style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '0.75rem' }}>
            <h2 className="text-xl font-bold flex items-center gap-2 text-main">
              <FileSearch className="text-primary" size={22} />
              SECTION 2 — Détail des Anomalies Détectées ({anomalies.length})
            </h2>

            {/* Filtres par gravité */}
            <div className="flex gap-2 print-hidden">
              <button
                onClick={() => setFilter('all')}
                className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '20px', padding: '0.3rem 0.85rem', fontSize: '0.8rem' }}
              >
                Toutes ({anomalies.length})
              </button>
              <button
                onClick={() => setFilter('high')}
                className={`btn btn-sm ${filter === 'high' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '20px', padding: '0.3rem 0.85rem', fontSize: '0.8rem' }}
              >
                Critiques ({anomalies.filter(a => a.severity === 'high').length})
              </button>
              <button
                onClick={() => setFilter('medium')}
                className={`btn btn-sm ${filter === 'medium' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '20px', padding: '0.3rem 0.85rem', fontSize: '0.8rem' }}
              >
                Moyennes ({anomalies.filter(a => a.severity !== 'high').length})
              </button>
            </div>
          </div>

          {filteredAnomalies.length === 0 ? (
            <div className="card text-center p-8 text-muted">
              Aucune anomalie correspondant au filtre sélectionné.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredAnomalies.map((anom, idx) => {
                const isOpen = openAnomalyIndex === idx;
                const isDocsOpen = openDocsIndex === idx;
                const docsList = Array.isArray(anom.docs) ? anom.docs : (anom.docs ? [anom.docs] : []);

                return (
                  <div 
                    key={idx} 
                    className="card" 
                    style={{ 
                      padding: '0', 
                      overflow: 'hidden', 
                      border: isOpen ? '1px solid var(--primary)' : '1px solid rgba(0,0,0,0.08)',
                      transition: 'border-color 0.2s ease'
                    }}
                  >
                    {/* Entête cliquable d’accordéon */}
                    <div 
                      onClick={() => setOpenAnomalyIndex(isOpen ? null : idx)}
                      style={{ 
                        padding: '1.25rem 1.5rem', 
                        cursor: 'pointer', 
                        background: isOpen ? 'rgba(37, 99, 235, 0.03)' : 'var(--bg-card)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div style={{
                          background: anom.severity === 'high' ? 'var(--error-bg)' : 'var(--warning-bg)',
                          color: anom.severity === 'high' ? 'var(--error)' : 'var(--warning)',
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '0.85rem',
                          flexShrink: 0
                        }}>
                          {idx + 1}
                        </div>
                        <div>
                          <h3 className="font-bold text-base" style={{ margin: 0, color: 'var(--text-main)' }}>
                            Année {anom.year} — {anom.employer || "Employeur non spécifié"}
                          </h3>
                          <p className="text-xs text-muted" style={{ margin: '0.15rem 0 0 0' }}>
                            {anom.title || anom.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`badge ${anom.severity === 'high' ? 'badge-error' : 'badge-warning'}`} style={{ fontSize: '0.75rem' }}>
                          {anom.severity === 'high' ? 'Critique' : 'Moyenne'}
                        </span>
                        <ChevronRight size={18} style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', color: 'var(--text-muted)' }} />
                      </div>
                    </div>

                    {/* Contenu dépliant d'accordéon */}
                    {isOpen && (
                      <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.06)', background: 'var(--bg-card)' }} className="flex flex-col gap-4 animate-fade-in">
                        <div className="details-grid">
                          <div>
                            <div className="text-xs text-muted">Salaire / Revenus</div>
                            <div className="font-semibold text-sm">{anom.salary || "Non renseigné"}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted">Trimestres</div>
                            <div className="font-semibold text-sm">{anom.trimesters || "0/4"}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted">Points</div>
                            <div className="font-semibold text-sm">{anom.points || "0.00"}</div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-xs uppercase tracking-wider text-error mb-1 flex items-center gap-1.5">
                            <AlertTriangle size={14} /> Constat technique
                          </h4>
                          <p className="text-sm text-muted" style={{ margin: 0 }}>{anom.reason || anom.description}</p>
                        </div>

                        <div style={{ background: 'var(--success-bg)', padding: '1.25rem', borderRadius: '10px', border: '1px solid rgba(22, 163, 74, 0.15)' }}>
                          <h4 className="font-semibold text-xs uppercase tracking-wider text-success mb-1 flex items-center gap-1.5">
                            <CheckCircle2 size={14} /> Solution recommandée
                          </h4>
                          <p className="text-sm font-medium text-main" style={{ margin: 0 }}>{anom.solution}</p>
                          
                          {/* Tiroir d'action pour Pièces Justificatives */}
                          <div className="mt-3 pt-3" style={{ borderTop: '1px dashed rgba(22, 163, 74, 0.2)' }}>
                            <button 
                              type="button"
                              onClick={() => setOpenDocsIndex(isDocsOpen ? null : idx)}
                              className="btn btn-secondary btn-sm flex items-center gap-2 text-xs"
                              style={{ padding: '0.4rem 0.8rem', minHeight: '32px' }}
                            >
                              <FileText size={14} />
                              <span>{isDocsOpen ? "Masquer les pièces à fournir" : `Voir les pièces à fournir (${docsList.length})`}</span>
                            </button>

                            {isDocsOpen && (
                              <div className="mt-3 animate-fade-in" style={{ background: 'rgba(255,255,255,0.8)', padding: '0.75rem 1rem', borderRadius: '8px' }}>
                                <div className="text-xs font-bold text-main mb-1">Documents administratifs nécessaires :</div>
                                <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                  {docsList.length > 0 ? (
                                    docsList.map((doc, dIdx) => <li key={dIdx}>{doc}</li>)
                                  ) : (
                                    <li>Bulletins de paie de l'année {anom.year}</li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 3 : PLAN D'ACTION CHRONOLOGIQUE CONSOLIDÉ */}
        <section className="flex flex-col gap-6 mt-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-main" style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '0.75rem' }}>
            <Sparkles className="text-primary" size={22} />
            SECTION 3 — Plan d'Action Chronologique
          </h2>

          <div className="flex flex-col gap-4">
            {actionPlan.map((act, aIdx) => (
              <div 
                key={aIdx} 
                className="card" 
                style={{ 
                  padding: '1.25rem 1.5rem', 
                  display: 'flex', 
                  gap: '1.25rem', 
                  alignItems: 'flex-start',
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(0,0,0,0.06)'
                }}
              >
                <div style={{
                  background: 'var(--primary)',
                  color: 'white',
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  Étape {act.step || aIdx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 className="font-bold text-base" style={{ margin: 0, color: 'var(--text-main)' }}>{act.title}</h3>
                  <p className="text-sm text-muted mt-1" style={{ margin: 0, lineHeight: '1.6' }}>{act.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bloc d'urgence & Prise de rendez-vous stratégique */}
        <div className="flex flex-col items-center gap-4 mt-8 mb-16 print-hidden urgency-section" style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(212, 175, 55, 0.03) 100%)', padding: '3rem 2rem', borderRadius: '20px', border: '1px solid rgba(212, 175, 55, 0.3)', textAlign: 'center' }}>
          <h3 className="text-xl font-bold" style={{ color: '#b89218', letterSpacing: '-0.02em', margin: 0 }}>Besoin d'accompagnement pour vos démarches ?</h3>
          <p className="text-muted text-sm max-w-lg" style={{ margin: 0 }}>
            Nos experts en retraite vous accompagnent pas à pas pour régulariser votre dossier auprès des caisses et sécuriser vos droits.
          </p>

          <a 
            href="https://calendly.com/hologramconseils/reservez-votre-appel-strategique" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-primary btn-cta-premium mt-2"
            style={{ padding: '0.8rem 2rem', fontSize: '1rem', background: 'linear-gradient(135deg, #d4af37 0%, #b89218 100%)', color: 'white', border: 'none', borderRadius: '10px' }}
          >
            <span>Réserver un entretien stratégique offert</span>
          </a>
        </div>

      </div>
    </div>
  )
}
