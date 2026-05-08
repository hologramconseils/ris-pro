import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ChevronRight, Lock, Calendar, Building, DollarSign, Award, Loader2 } from 'lucide-react'

export default function Diagnostic() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const filePath = searchParams.get('file')
  
  const [loading, setLoading] = useState(!!filePath)
  const [error, setError] = useState(null)
  const [results, setResults] = useState(null)

  useEffect(() => {
    if (filePath) {
      runAnalysis()
    }
  }, [filePath])

  const runAnalysis = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setResults(data)
      } else {
        throw new Error(data.details || data.error || "L'analyse a échoué")
      }
    } catch (err) {
      console.error("Erreur API Analyze:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe
      } else {
        alert("Erreur lors de la création de la session de paiement.");
      }
    } catch (error) {
      console.error("Erreur de connexion à Stripe:", error);
      alert("Redirection vers Stripe Checkout (Simulation car backend injoignable)...");
      navigate('/bilan?success=true');
    }
  }

  // Données de secours si aucune analyse n'est en cours (pour la démo)
  const demoAnomalies = [
    {
      year: '1998',
      employer: 'DURAND SA',
      salary: '12 450 €',
      trimesters: '3/4',
      points: '85.2',
      reason: 'Salaire brut suffisant pour valider 4 trimestres, mais seulement 3 ont été reportés par la caisse.',
    },
    {
      year: '2023',
      employer: 'TECH CORP',
      salary: '45 000 €',
      trimesters: '4/4',
      points: '0.0',
      reason: 'Points Agirc-Arrco manquants. L\'employeur a déclaré les revenus à l\'Urssaf mais le flux vers la caisse complémentaire a échoué.',
    }
  ]

  const anomalies = results?.anomalies || demoAnomalies

  if (loading) {
    return (
      <div className="container flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 className="animate-spin text-primary" size={48} />
        <h2 className="text-2xl font-bold mt-4">Analyse de votre carrière en cours...</h2>
        <p className="text-muted mt-2">Nous vérifions vos trimestres et points Agirc-Arrco (env. 30s)</p>
      </div>
    )
  }

  return (
    <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', flex: 1 }}>
      <div className="flex flex-col gap-8" style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        <div className="text-center">
          <div className="badge badge-warning" style={{ marginBottom: '1rem' }}>
            {results ? 'Audit Réel' : 'Diagnostic de Démonstration'}
          </div>
          <h1 className="text-3xl font-bold">
            {error ? "L'analyse a rencontré un problème" : "Votre analyse est prête."}
          </h1>
          {error ? (
            <div className="text-danger mt-4 p-4 glass rounded-lg border border-red-200">
              {error}
              <button onClick={runAnalysis} className="btn btn-sm btn-outline-danger ml-4">Réessayer</button>
            </div>
          ) : (
            <p className="text-lg text-muted" style={{ marginTop: '0.5rem' }}>
              Nous avons audité votre document. Voici un aperçu des erreurs identifiées.
            </p>
          )}
        </div>

        {!error && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <AlertCircle className="text-warning" size={24} />
              Extrait des anomalies {results ? '(Données réelles)' : '(Gratuit)'}
            </h2>
            
            {anomalies.map((anom, idx) => (
              <div key={idx} className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--warning)' }}>
                <div className="flex justify-between items-start" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Calendar size={18} className="text-muted" /> Année {anom.year}
                    </h3>
                    <div className="text-muted font-medium flex items-center gap-2" style={{ marginTop: '0.25rem' }}>
                      <Building size={16} /> {anom.employer || 'Non spécifié'}
                    </div>
                  </div>
                  
                  <div className="flex gap-4 flex-wrap">
                    <div style={{ background: 'var(--bg-page)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                      <div className="text-xs text-muted uppercase tracking-wider flex items-center gap-1"><DollarSign size={12}/> Salaire</div>
                      <div className="font-semibold">{anom.salary || '-'}</div>
                    </div>
                    <div style={{ background: 'var(--bg-page)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                      <div className="text-xs text-muted uppercase tracking-wider flex items-center gap-1"><Calendar size={12}/> Trimestres</div>
                      <div className="font-semibold">{anom.trimesters}</div>
                    </div>
                    <div style={{ background: 'var(--bg-page)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                      <div className="text-xs text-muted uppercase tracking-wider flex items-center gap-1"><Award size={12}/> Points</div>
                      <div className="font-semibold">{anom.points || '0.00'}</div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--warning-bg)', color: 'var(--text-main)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem' }}>
                  <strong>Explication :</strong> {anom.reason}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card glass flex flex-col items-center text-center" style={{ background: 'linear-gradient(to right bottom, var(--bg-card), var(--bg-page))', border: '1px solid var(--primary)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-50%', right: '-10%', width: '300px', height: '300px', background: 'var(--primary)', opacity: 0.05, borderRadius: '50%', filter: 'blur(40px)' }} />
          
          <Lock size={32} className="text-primary" style={{ marginBottom: '1rem' }} />
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.5rem' }}>
            {results ? `Votre audit révèle ${results.anomalies.length} anomalies` : "Votre audit révèle d'autres anomalies"}
          </h2>
          <p className="text-muted" style={{ maxWidth: '500px', marginBottom: '2rem' }}>
            Débloquez le bilan complet pour voir l'intégralité de votre carrière, la liste des justificatifs requis et générer vos courriers de réclamation pré-remplis.
          </p>
          
          <button className="btn btn-primary" style={{ fontSize: '1.125rem', padding: '1rem 2rem' }} onClick={handlePayment}>
            Accéder au Bilan Détaillé pour 29€
            <ChevronRight size={20} />
          </button>
          <div className="text-xs text-muted mt-4" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={12} /> Paiement 100% sécurisé via Stripe
          </div>
        </div>

      </div>
    </div>
  )
}
