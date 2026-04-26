import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Download, FileText, FileSearch, HelpCircle, Loader2, Lock } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { supabase } from '../lib/supabase'

export default function Bilan() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const filePath = searchParams.get('file')
  const isSuccess = searchParams.get('success') === 'true'
  const isMock = searchParams.get('mock') === 'true'
  
  const [loading, setLoading] = useState(!!filePath)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (filePath) {
      fetchAnalysis(filePath)
    }

    // Si on vient de payer mais que le profil n'est pas encore à jour (latence Webhook)
    if (isSuccess && user && profile && !profile.has_paid) {
      const timer = setTimeout(() => {
        refreshProfile()
      }, 3000) // 3 secondes pour être large
      return () => clearTimeout(timer)
    }
  }, [filePath, isSuccess, user, profile?.has_paid])

  const fetchAnalysis = async (path) => {
    try {
      setLoading(true)

      // 1. D'abord on vérifie la session (pour l'affichage instantané après analyse)
      const cached = sessionStorage.getItem(`ris_pro_analysis_${path}`);
      if (cached) {
        setResults(JSON.parse(cached));
        setLoading(false);
        return;
      }

      // 2. Sinon, on tente la base de données
      const { data, error: dbError } = await supabase
        .from('analyses')
        .select('results')
        .eq('file_path', path)
        .order('created_at', { ascending: false })
        .limit(1)

      if (dbError) throw dbError
      if (data && data.length > 0 && data[0].results) {
        setResults(data[0].results)
      } else {
        throw new Error("Aucun résultat trouvé pour ce document. Assurez-vous d'avoir lancé l'analyse sur la page d'accueil.")
      }
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    window.print()
  }

  if (authLoading) {
    return (
      <div className="container flex items-center justify-center" style={{ flex: 1 }}>
        <div className="flex flex-col items-center gap-4 text-primary">
          <Loader2 className="animate-spin" size={32} />
          <p>Vérification des accès...</p>
        </div>
      </div>
    )
  }

  // État de transition : on vient de payer, on attend la confirmation du webhook
  const isWaitingForPayment = isSuccess && user && profile && !profile.has_paid

  // LOGIQUE D'ACCÈS : Autorisé si (Admin) OU (Mode Mock) OU (Utilisateur a payé) OU (Retour immédiat de paiement réussi)
  const isAuthorized = profile?.role === 'admin' || isMock || profile?.has_paid || isSuccess

  // Si on est en train de charger l'auth
  if (authLoading && !isSuccess) {
    return (
      <div className="container flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: '1.5rem' }}>
        <Loader2 size={48} className="animate-spin text-primary" />
        <div className="text-center">
          <h2 className="text-2xl font-bold">Vérification de votre accès...</h2>
        </div>
      </div>
    )
  }

  // Si on n'est pas autorisé
  if (!isAuthorized) {
    return (
      <div className="container flex flex-col items-center justify-center gap-6" style={{ flex: 1, padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div style={{ background: 'var(--error-bg)', padding: '1rem', borderRadius: '50%', color: 'var(--error)' }}>
          <Lock size={48} />
        </div>
        <h1 className="text-3xl font-bold">Accès Restreint</h1>
        <p className="text-muted max-w-lg">
          Vous devez posséder un compte et avoir débloqué l'accès Premium pour consulter le bilan détaillé.
        </p>
        <div className="flex gap-4">
          <button className="btn btn-secondary" onClick={() => refreshProfile()}>
            Actualiser mon statut
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/login')}>
            Se connecter
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
          <h2 className="text-2xl font-bold mb-2">Chargement de votre bilan premium...</h2>
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
            {error || "Nous n'avons pas pu charger votre bilan. Veuillez réessayer."}
          </p>
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

  return (
    <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', flex: 1 }}>
      <div className="flex flex-col gap-8" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        <div className="flex justify-between items-end flex-wrap gap-4">
          <div>
            <div className="badge badge-primary" style={{ marginBottom: '1rem', background: 'var(--primary)', color: 'white' }}>Bilan Détaillé Premium</div>
            <h1 className="text-3xl font-bold">Audit Complet de votre Carrière</h1>
            <p className="text-muted mt-2">Document analysé le {new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>

        {/* Synthesis Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
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

        {/* Anomalies Details */}
        <div className="flex flex-col gap-6 mt-4">
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '1rem' }}>
            <FileSearch className="text-primary" />
            Détail des anomalies
          </h2>

          {anomalies.map((anom, idx) => (
            <div key={idx} className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '2rem' }}>
              {/* Header */}
              <div style={{ padding: '1.5rem', background: 'var(--bg-card-hover)', borderBottom: '1px solid rgba(0,0,0,0.05)' }} className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div style={{ background: 'var(--error-bg)', color: 'var(--error)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Année {anom.year} - {anom.employer}</h3>
                  </div>
                </div>
                <div className="badge badge-error">Anomalie confirmée</div>
              </div>
              
              {/* Body */}
              <div style={{ padding: '1.5rem' }} className="flex flex-col gap-6">
                {/* Data context */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', background: 'var(--bg-page)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
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

                {/* Explanation */}
                <div>
                  <h4 className="font-semibold flex items-center gap-2 text-error mb-2">
                    <AlertTriangle size={16} /> Explication de l'erreur
                  </h4>
                  <p className="text-muted">{anom.reason}</p>
                </div>
                
                {/* Solution & Docs */}
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
          ))}
        </div>

      </div>
    </div>
  )
}
