import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ChevronRight, Lock, Calendar, Building, DollarSign, Award, Loader2, AlertTriangle, UserPlus, ShieldAlert } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { supabase } from '../lib/supabase'

export default function Diagnostic() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const filePath = searchParams.get('file')
  
  const [loading, setLoading] = useState(!!filePath)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const [showSignup, setShowSignup] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (filePath) {
      performAnalysis(filePath)
    }
  }, [filePath])

  const performAnalysis = async (path) => {
    try {
      setLoading(true)
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: path })
      })

      if (!response.ok) throw new Error("L'analyse a échoué")
      
      const data = await response.json()
      setResults(data)
    } catch (err) {
      console.error(err)
      setError("Désolé, nous n'avons pas pu analyser votre document. Vérifiez votre clé d'accès au moteur d'analyse.")
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    if (results) {
      sessionStorage.setItem(`ris_pro_analysis_${filePath}`, JSON.stringify(results));
    }

    if (!user) {
      setShowSignup(true)
      return
    }

    if (profile?.has_paid || profile?.role === 'admin') {
      navigate(`/bilan?success=true&file=${encodeURIComponent(filePath)}`)
      return
    }

    try {
      const response = await fetch('http://localhost:3001/api/create-checkout-session', {
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

      const response = await fetch('http://localhost:3001/api/create-checkout-session', {
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
      <div className="container flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: '2rem' }}>
        <Loader2 size={48} className="animate-spin text-primary" />
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Analyse intelligente en cours...</h2>
          <p className="text-muted">Le moteur d'expertise examine votre relevé de carrière (RIS / EIG)</p>
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
          <button onClick={() => navigate('/')} className="btn btn-primary mx-auto">Retour à l'accueil</button>
        </div>
      </div>
    )
  }

  const anomalies = results.anomalies || []
  const freemiumAnomalies = anomalies.slice(0, 2)
  const hasMore = anomalies.length > 2

  return (
    <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', flex: 1 }}>
      <div className="flex flex-col gap-8" style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <div className="text-center">
          <div className="badge badge-warning" style={{ marginBottom: '1rem' }}>
            Diagnostic Freemium
          </div>
          <h1 className="text-3xl font-bold">Votre analyse est prête.</h1>
          <p className="text-lg text-muted" style={{ marginTop: '0.5rem' }}>
            {results.summary || "Nous avons audité votre document. Voici un aperçu des erreurs identifiées."}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <AlertCircle className="text-warning" size={24} />
            Anomalies identifiées ({anomalies.length})
          </h2>
          
          {freemiumAnomalies.map((anom, idx) => (
            <div key={idx} className="card" style={{ padding: '1.5rem', borderLeft: `4px solid ${anom.severity === 'high' ? 'var(--danger)' : 'var(--warning)'}` }}>
              <div className="flex justify-between items-start" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Calendar size={18} className="text-muted" /> {anom.year || "Année non spécifiée"}
                  </h3>
                </div>
                
                <div className="flex gap-4 flex-wrap">
                  <div style={{ background: 'var(--bg-page)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                    <div className="text-[10px] text-muted uppercase tracking-wider">Sévérité</div>
                    <div className="font-bold uppercase text-xs" style={{ color: anom.severity === 'high' ? 'var(--danger)' : 'var(--warning)' }}>
                      {anom.severity === 'high' ? 'Critique' : 'Moyenne'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: '1rem' }}>
                <h4 className="font-bold text-base mb-1">{anom.title}</h4>
                <p className="text-muted text-sm leading-relaxed">
                  {anom.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Upgrade Card / Signup Form */}
        <div className="card glass flex flex-col items-center text-center" style={{ background: 'linear-gradient(to right bottom, var(--bg-card), var(--bg-page))', border: '1px solid var(--primary)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-50%', right: '-10%', width: '300px', height: '300px', background: 'var(--primary)', opacity: 0.05, borderRadius: '50%', filter: 'blur(40px)' }} />
          
          <Lock size={32} className="text-primary" style={{ marginBottom: '1rem' }} />
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.5rem' }}>
            {hasMore ? `Votre audit révèle ${anomalies.length - 2} autres anomalies` : "Accédez à votre bilan détaillé"}
          </h2>
          <p className="text-muted" style={{ maxWidth: '500px', marginBottom: '2rem' }}>
            Débloquez le bilan complet pour voir l'intégralité de votre carrière, la liste des justificatifs requis et générer vos courriers de réclamation pré-remplis.
          </p>
          
          {showSignup ? (
            <form onSubmit={handleSignupAndPay} className="flex flex-col gap-4 text-left w-full max-w-md bg-page p-6 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
              <div className="flex gap-4">
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-sm font-semibold">Prénom</label>
                  <input type="text" className="input" placeholder="Jean" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-sm font-semibold">Nom</label>
                  <input type="text" className="input" placeholder="Dupont" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold">Email</label>
                <input type="email" className="input" placeholder="votre@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold">Mot de passe</label>
                <input type="password" className="input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              
              {authError && (
                <div className="flex items-center gap-2 text-error text-sm p-3 bg-error-bg rounded-lg">
                  <ShieldAlert size={16} />
                  {authError}
                </div>
              )}

              <button type="submit" className="btn btn-primary mt-2 w-full py-3" disabled={authLoading}>
                {authLoading ? <Loader2 className="animate-spin" /> : 'Créer mon compte et Payer 29€'}
              </button>
            </form>
          ) : (
            <>
              <button className="btn btn-primary" style={{ fontSize: '1.125rem', padding: '1rem 2rem' }} onClick={handlePayment}>
                {profile?.role === 'admin' ? "Accéder au bilan complet (Admin)" : (user ? "Continuer vers le paiement (29€)" : "Créer mon compte pour débloquer (29€)")}
                <ChevronRight size={20} />
              </button>
              <div className="text-xs text-muted mt-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={12} /> Paiement 100% sécurisé via Stripe
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
