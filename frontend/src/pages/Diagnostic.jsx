import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ChevronRight, Lock, Calendar, Building, DollarSign, Award, Loader2, AlertTriangle, UserPlus, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { supabase } from '../lib/supabase'
import { LABELS } from '../config/labels'

export default function Diagnostic() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const filePath = searchParams.get('file')
  const [loading, setLoading] = useState(!!filePath)
  const [results, setResults] = useState(null)
  
  const hasCredits = results ? !results.is_restricted : ((profile?.analysis_credits || 0) > 0)
  const displayCredits = profile?.analysis_credits !== undefined && profile?.analysis_credits !== null ? profile.analysis_credits : 0

  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)

  const steps = [
    { label: "Chiffrement et anonymisation des données", duration: 2500 },
    { label: "Numérisation et lecture OCR du relevé", duration: 3000 },
    { label: "Extraction des salaires et identification des trimestres manquants", duration: 3500 },
    { label: "Analyse croisée", duration: 3000 },
    { label: "Génération du rapport et des stratégies d'optimisation", duration: 4000 }
  ]

  useEffect(() => {
    if (!loading) return;
    setProgress(0);
    setCurrentStep(0);
    
    // Simuler une progression fluide jusqu'à 99%
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev < 99) {
          const increment = Math.max(1, Math.floor((100 - prev) / 12));
          return prev + increment;
        }
        return prev;
      });
    }, 450);

    // Simuler le passage dynamique des étapes de l'audit
    let stepTimer = setTimeout(function advance() {
      setCurrentStep(prev => {
        if (prev < steps.length - 1) {
          stepTimer = setTimeout(advance, steps[prev + 1].duration);
          return prev + 1;
        }
        return prev;
      });
    }, steps[0].duration);

    return () => {
      clearInterval(interval);
      clearTimeout(stepTimer);
    };
  }, [loading]);

  const [showSignup, setShowSignup] = useState(false)
  const [showAuthChoice, setShowAuthChoice] = useState(false)
  const [showGuestCheckout, setShowGuestCheckout] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [checkoutEmail, setCheckoutEmail] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  useEffect(() => {
    if (filePath) {
      const cached = sessionStorage.getItem(`ris_pro_analysis_${filePath}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed?.is_restricted && user) {
          sessionStorage.removeItem(`ris_pro_analysis_${filePath}`)
          performAnalysis(filePath)
        } else {
          setResults(parsed)
          setLoading(false)
        }
      } else {
        performAnalysis(filePath)
      }
    }
  }, [filePath, user?.id])

  const performAnalysis = async (path) => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ filePath: path, userId: user?.id })
      })

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || LABELS.ERROR_ANALYSIS);
      }
      
      const data = await response.json()
      setResults(data)
    } catch (err) {
      console.error(err)
      setError(err.message || LABELS.ERROR_ANALYSIS)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async () => {
    if (results) {
      sessionStorage.setItem(`ris_pro_analysis_${filePath}`, JSON.stringify(results));
    }

    if (!user) {
      setShowAuthChoice(true)
      return
    }

    // Si admin ou a déjà payé (legacy) ou a des crédits restants
    const isAdmin = profile?.role === 'admin' || user?.email === 'btsaulnerond@icloud.com';

    if (isAdmin || hasCredits) {
      navigate(`/bilan?success=true&file=${encodeURIComponent(filePath)}`)
      return
    }

    // Sinon -> Paiement
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          userEmail: user.email,
          filePath: filePath
        })
      });
      
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Erreur d'initialisation du paiement.");
      }
    } catch (err) {
      console.error("Erreur Checkout:", err)
      setError("Le service de paiement est indisponible.");
    }
  }

  const handleGuestCheckout = async (e) => {
    e.preventDefault()
    if (!checkoutEmail || !checkoutEmail.includes('@')) {
      setCheckoutError('Veuillez entrer une adresse email valide.')
      return
    }
    setCheckoutLoading(true)
    setCheckoutError('')
    try {
      if (results) {
        sessionStorage.setItem(`ris_pro_analysis_${filePath}`, JSON.stringify(results));
      }
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: null,
          userEmail: checkoutEmail,
          filePath: filePath
        })
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError("Erreur d'initialisation du paiement. Veuillez réessayer.");
      }
    } catch (err) {
      console.error('Erreur Guest Checkout:', err)
      setCheckoutError('Le service de paiement est indisponible.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const handleSignupAndPay = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { first_name: firstName, last_name: lastName } }
      })
      if (signUpError) throw signUpError
      
      const createdUser = data.user
      
      if (results) {
        sessionStorage.setItem(`ris_pro_analysis_${filePath}`, JSON.stringify(results));
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: createdUser.id, 
          userEmail: createdUser.email,
          filePath: filePath
        })
      });
      const resData = await response.json();
      
      if (resData.url) {
        window.location.href = resData.url;
      } else {
        setAuthError("Erreur d'initialisation du paiement.");
      }
    } catch (err) {
      console.error(err)
      setAuthError(err.message || "Une erreur est survenue lors de l'inscription.")
    } finally {
      setAuthLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container flex flex-col items-center justify-center animate-fade-in" style={{ minHeight: '80vh', padding: '2rem 1.5rem' }}>
        <div className="card glass text-center" style={{ maxWidth: '520px', width: '100%', padding: '3rem 2rem', borderRadius: '24px', boxShadow: 'var(--shadow-lg), var(--shadow-glow)' }}>
          {/* Cercle de progression SVG */}
          <div style={{ position: 'relative', width: '130px', height: '130px', margin: '0 auto 2.5rem' }}>
            <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="65" cy="65" r="58" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle cx="65" cy="65" r="58" fill="none" stroke="var(--primary)" strokeWidth="6"
                      strokeDasharray="364.42" strokeDashoffset={364.42 - (364.42 * progress) / 100}
                      style={{ transition: 'stroke-dashoffset 0.3s ease-out' }} />
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontFamily: '"Outfit", sans-serif', fontWeight: '900', fontSize: '2rem', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {progress}%
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: '"Outfit", sans-serif', letterSpacing: '-0.02em' }}>
            Analyse intelligente en cours...
          </h2>
          <p className="text-muted text-sm mb-8" style={{ minHeight: '20px' }}>
            {steps[currentStep] ? `${steps[currentStep].label} en cours...` : "Traitement en cours..."}
          </p>

          {/* Liste des étapes de l'audit */}
          <div className="flex flex-col gap-4 text-left" style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '2rem' }}>
            {steps.map((step, idx) => {
              const isCompleted = currentStep > idx;
              const isActive = currentStep === idx;
              return (
                <div key={idx} className="flex items-center gap-3.5" style={{ 
                  opacity: isCompleted || isActive ? 1 : 0.4,
                  transition: 'opacity 0.4s ease'
                }}>
                  {isCompleted ? (
                    <CheckCircle2 size={20} className="text-success" style={{ flexShrink: 0 }} />
                  ) : isActive ? (
                    <Loader2 size={20} className="animate-spin text-primary" style={{ flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                  )}
                  <span style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: isActive ? '700' : '500', 
                    color: isActive ? 'var(--primary)' : 'var(--text-main)',
                    transition: 'color 0.4s ease'
                  }}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )
  }

  if (error || (!results && !loading)) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem' }}>
        <div className="card glass text-center p-8">
          <AlertTriangle size={48} className="text-warning mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{error ? "Erreur d'analyse" : "Aucun document"}</h2>
          <p className="text-muted mb-6">
            {error || "Veuillez d'abord uploader votre relevé de carrière sur la page d'accueil."}
          </p>
          <button onClick={() => navigate('/')} className="btn btn-primary mx-auto">{LABELS.CTA_RETRY}</button>
        </div>
      </div>
    )
  }

  const rawAnomalies = results.anomalies || []
  const currentYear = new Date().getFullYear()
  
  const sortedAnomalies = [...rawAnomalies].sort((a, b) => {
    const yearA = parseInt(String(a.year).match(/\d{4}/)?.[0] || '0')
    const yearB = parseInt(String(b.year).match(/\d{4}/)?.[0] || '0')
    return yearA - yearB
  })

  const validAnomalies = sortedAnomalies.filter(a => {
    const year = parseInt(String(a.year).match(/\d{4}/)?.[0] || '0')
    return year < currentYear
  })

  const freemiumAnomalies = []
  if (validAnomalies.length > 0) {
    freemiumAnomalies.push(validAnomalies[0]) // Plus ancienne
    if (validAnomalies.length > 1) {
      freemiumAnomalies.push(validAnomalies[validAnomalies.length - 1]) // Plus récente
    }
  }

  const hasMore = sortedAnomalies.length > freemiumAnomalies.length;

  return (
    <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', flex: 1 }}>
      <div className="flex flex-col gap-8" style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <div className="text-center">
          <div className="badge badge-warning" style={{ marginBottom: '1rem' }}>
            Diagnostic Freemium
          </div>
          <h1 className="text-3xl font-bold">{LABELS.ANALYSIS_READY}</h1>
          <p className="text-lg text-muted" style={{ marginTop: '0.5rem' }}>
            {results.summary || "Nous avons audité votre document. Voici un aperçu des erreurs identifiées."}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <AlertCircle className="text-warning" size={24} />
            Anomalies identifiées ({sortedAnomalies.length})
          </h2>
          
          {freemiumAnomalies.map((anom, idx) => (
            <div 
              key={idx} 
              className={`anomaly-card card ${anom.severity === 'high' ? 'high-severity' : ''}`} 
              style={{ 
                padding: '2rem 1.75rem', 
                position: 'relative', 
                overflow: 'hidden',
                borderLeft: anom.severity === 'high' ? '5px solid var(--error)' : '5px solid var(--warning)',
                borderRadius: '12px',
                background: 'var(--bg-card)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: '1.5rem',
                borderTop: '1px solid rgba(0, 0, 0, 0.04)',
                borderRight: '1px solid rgba(0, 0, 0, 0.04)',
                borderBottom: '1px solid rgba(0, 0, 0, 0.04)'
              }}
            >
              {/* Number watermark */}
              <div style={{
                position: 'absolute',
                right: '1.5rem',
                bottom: '0.25rem',
                fontSize: '4.5rem',
                fontWeight: '900',
                opacity: '0.04',
                color: 'var(--text-main)',
                fontFamily: '"Outfit", sans-serif',
                userSelect: 'none'
              }}>
                0{idx + 1}
              </div>

              <div className="anomaly-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '1rem' }}>
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                    <Calendar size={18} className="text-primary" /> Année {anom.year || "Non spécifiée"}
                  </h3>
                </div>
                
                <div>
                  <div className="badge" style={{
                    background: anom.severity === 'high' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                    color: anom.severity === 'high' ? 'var(--error)' : 'var(--warning)',
                    border: '1px solid transparent',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    borderRadius: '8px'
                  }}>
                    {anom.severity === 'high' ? 'ANOMALIE CRITIQUE' : 'ANOMALIE MOYENNE'}
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: '1.25rem', zIndex: 1, position: 'relative', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <h4 className="font-bold text-base mb-2" style={{ color: 'var(--text-main)' }}>{anom.title}</h4>
                  <p className="text-muted text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {anom.description}
                  </p>
                </div>

                {anom.reason && anom.reason !== "Masqué (Premium)" && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <h4 className="font-semibold flex items-center gap-2 text-error text-sm mb-1">
                      <AlertTriangle size={15} /> Explication de l'erreur
                    </h4>
                    <p className="text-sm text-muted">{anom.reason}</p>
                  </div>
                )}

                {anom.solution && anom.solution !== "Masqué (Premium)" && (
                  <div style={{ background: 'var(--success-bg)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(22, 163, 74, 0.2)', marginTop: '0.5rem' }}>
                    <h4 className="font-semibold flex items-center gap-2 text-success text-sm mb-1.5">
                      <CheckCircle2 size={15} /> Action requise
                    </h4>
                    <p className="text-sm font-medium mb-3">{anom.solution}</p>
                    
                    {anom.docs && anom.docs.length > 0 && anom.docs[0] !== "Pièces justificatives masquées" && (
                      <>
                        <div className="text-xs font-bold uppercase tracking-wider text-success mb-1" style={{ opacity: 0.8 }}>Pièces justificatives à fournir :</div>
                        <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                          {Array.isArray(anom.docs) ? anom.docs.map((doc, docIdx) => (
                            <li key={docIdx} style={{ marginBottom: '0.15rem' }}>{doc}</li>
                          )) : (
                            <li style={{ marginBottom: '0.15rem' }}>{anom.docs}</li>
                          )}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Upgrade Card / Signup Form */}
        <div 
          className="card glass flex flex-col items-center text-center" 
          style={{ 
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.8) 100%)', 
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '2px solid transparent',
            backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, var(--primary) 0%, #d4af37 100%)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            position: 'relative', 
            overflow: 'hidden',
            padding: '3rem 2rem',
            borderRadius: '24px',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ position: 'absolute', top: '-50%', right: '-10%', width: '300px', height: '300px', background: 'var(--primary)', opacity: 0.03, borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
          
          <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #d4af37 100%)', width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', boxShadow: '0 8px 16px -4px rgba(212, 175, 55, 0.3)' }}>
            <Lock size={28} className="text-white" />
          </div>
          
          <h2 className="text-2xl font-extrabold" style={{ marginBottom: '0.75rem', letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
            {hasMore ? `Votre audit révèle ${sortedAnomalies.length - freemiumAnomalies.length} autres anomalies` : "Accédez à votre bilan détaillé"}
          </h2>
          <p className="text-muted text-sm leading-relaxed" style={{ maxWidth: '540px', marginBottom: '2.5rem', color: 'var(--text-muted)' }}>
            Débloquez l’analyse complète et détaillée pour voir l’intégralité des anomalies détectées en quelques minutes ainsi que la liste (non exhaustive) des pièces justificatives requises pour demander la correction de votre carrière.
          </p>
          
          {showAuthChoice ? (
            <div className="auth-choice-container" style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* CTA principal : achat direct sans compte */}
              <div className="guest-checkout-section" style={{ width: '100%' }}>
                {!showGuestCheckout ? (
                  <button
                    className="btn btn-primary btn-cta-premium w-full"
                    onClick={() => { setShowGuestCheckout(true); }}
                    style={{ padding: '0.8rem 1.5rem', minHeight: '48px', height: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <span>Accédez à l'analyse détaillée pour 39 €</span>
                    <ChevronRight size={18} />
                  </button>
                ) : (
                  <form onSubmit={handleGuestCheckout} className="guest-checkout-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                    <p className="guest-checkout-label" style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Entrez votre email pour recevoir votre accès :</p>
                    <div className="guest-checkout-fields" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <input
                        type="email"
                        className="input"
                        placeholder="votre@email.com"
                        value={checkoutEmail}
                        onChange={(e) => setCheckoutEmail(e.target.value)}
                        required
                        style={{ width: '100%', minHeight: '44px', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.12)' }}
                      />
                      {checkoutError && (
                        <div className="flex items-center gap-2 text-error text-sm p-3 bg-error-bg rounded-lg">
                          <ShieldAlert size={16} />
                          {checkoutError}
                        </div>
                      )}
                      <button type="submit" className="btn btn-primary btn-cta-premium w-full" disabled={checkoutLoading} style={{ minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {checkoutLoading ? <Loader2 className="animate-spin" size={18} /> : <span>Payer 39 € et accéder à l'analyse</span>}
                      </button>
                      <button type="button" className="btn btn-ghost text-sm" onClick={() => setShowGuestCheckout(false)} style={{ minHeight: '36px' }}>
                        ← Retour
                      </button>
                    </div>
                  </form>
                )}
                <div className="text-xs text-muted text-center mt-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                  <Lock size={11} className="text-success" /> Paiement sécurisé • Accès immédiat après paiement
                </div>
              </div>

              {/* Séparateur */}
              <div className="auth-divider" style={{ display: 'flex', alignItems: 'center', width: '100%', margin: '0.5rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }}></div>
                <span style={{ padding: '0 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>ou</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }}></div>
              </div>

              {/* Options compte */}
              <div className="auth-account-options" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p className="auth-account-label" style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Sauvegardez votre analyse dans votre espace personnel</p>
                <button
                  className="btn btn-secondary w-full"
                  onClick={() => {
                    if (results) sessionStorage.setItem(`ris_pro_analysis_${filePath}`, JSON.stringify(results));
                    navigate(`/login?redirect=${encodeURIComponent('/diagnostic?file=' + (filePath || ''))}&signup=true`);
                  }}
                  style={{ minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'rgb(37, 99, 235)' }}
                >
                  <UserPlus size={18} />
                  <span style={{ marginLeft: '0.25rem' }}>Créer un compte</span>
                  <ChevronRight size={18} />
                </button>
                
                <p className="auth-account-label" style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: '0.25rem' }}>Déjà inscrit ?</p>
                <button
                  className="btn btn-ghost w-full"
                  onClick={() => {
                    if (results) sessionStorage.setItem(`ris_pro_analysis_${filePath}`, JSON.stringify(results));
                    navigate(`/login?redirect=${encodeURIComponent('/diagnostic?file=' + (filePath || ''))}`);
                  }}
                  style={{ minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)' }}
                >
                  <span>Se connecter</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <button 
                className="btn btn-primary btn-cta-premium" 
                onClick={handleAction} 
                style={{ 
                  padding: '1rem 2.5rem', 
                  minHeight: '54px', 
                  height: 'auto',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: '700',
                  boxShadow: '0 10px 20px -6px rgba(var(--primary-rgb), 0.2)'
                }}
              >
                <span>
                  {profile?.role === 'admin' || user?.email === 'btsaulnerond@icloud.com' 
                    ? "Accéder au bilan complet (Admin)" 
                    : (user 
                        ? (hasCredits 
                            ? LABELS.CTA_CONTINUE_ANALYSIS
                            : (profile?.is_paid 
                                ? LABELS.PAYMENT_RENEW 
                                : LABELS.PAYMENT_REQUIRED))
                        : LABELS.PAYMENT_REQUIRED)}
                </span>
                <ChevronRight size={20} />
              </button>
              <div className="text-xs text-muted mt-4" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                <Lock size={12} className="text-success" /> {LABELS.PAYMENT_SECURE}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-4 mt-8 mb-12">
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
