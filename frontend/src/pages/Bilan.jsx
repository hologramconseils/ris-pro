import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Download, FileText, FileSearch, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Bilan() {
  const [searchParams] = useSearchParams()
  const filePath = searchParams.get('file')
  
  const [loading, setLoading] = useState(!!filePath)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (filePath) {
      loadResults()
    }
  }, [filePath])

  const loadResults = async () => {
    try {
      setLoading(true)
      const { data, error: dbError } = await supabase
        .from('analyses')
        .select('results')
        .eq('file_path', filePath)
        .single()

      if (dbError) throw dbError
      if (data?.results) {
        setResults(data.results)
      }
    } catch (err) {
      console.error("Erreur chargement résultats:", err)
      setError("Impossible de charger les résultats de votre audit.")
    } finally {
      setLoading(false)
    }
  }

  // Données de démonstration si aucun résultat réel n'est trouvé
  const demoAnomalies = [
    {
      year: '1998',
      employer: 'DURAND SA',
      salary: '12 450 €',
      trimesters: '3/4',
      points: '85.2',
      reason: 'Salaire brut suffisant pour valider 4 trimestres, mais seulement 3 ont été reportés par la caisse.',
      solution: 'Demander la validation du trimestre manquant à la CNAV.',
      docs: ['Bulletin de salaire de Décembre 1998', 'Attestation employeur']
    },
    {
      year: '2015',
      employer: 'Pôle Emploi',
      salary: 'Chômage',
      trimesters: '0/4',
      points: '0.0',
      reason: 'Période de chômage indemnisé non reportée sur le relevé de carrière.',
      solution: 'Faire valoir la période de chômage pour l\'acquisition de trimestres assimilés.',
      docs: ['Attestation Pôle Emploi des périodes indemnisées 2015']
    }
  ]

  const anomalies = results?.anomalies || demoAnomalies

  const handleExport = () => {
    alert("Génération du PDF du bilan en cours...")
  }

  const handleLetter = () => {
    alert("Génération du modèle de courrier de réclamation...")
  }

  if (loading) {
    return (
      <div className="container flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 className="animate-spin text-primary" size={48} />
        <h2 className="text-2xl font-bold mt-4">Chargement de votre bilan détaillé...</h2>
      </div>
    )
  }

  return (
    <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', flex: 1 }}>
      <div className="flex flex-col gap-8" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        <div className="flex justify-between items-end flex-wrap gap-4">
          <div>
            <div className="badge badge-primary" style={{ marginBottom: '1rem', background: 'var(--primary)', color: 'white' }}>
              Bilan Détaillé Premium
            </div>
            <h1 className="text-3xl font-bold">Audit Complet de votre Carrière</h1>
            <p className="text-muted mt-2">Document analysé le {new Date().toLocaleDateString('fr-FR')}</p>
          </div>
          
          <div className="flex gap-4">
            <button className="btn btn-secondary" onClick={handleLetter}>
              <FileText size={18} />
              Générer courriers
            </button>
            <button className="btn btn-primary" onClick={handleExport}>
              <Download size={18} />
              Exporter PDF
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        {/* Synthesis Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="text-sm text-muted uppercase tracking-wide font-bold">Total Anomalies</div>
            <div className="text-3xl font-bold text-error">{anomalies.length}</div>
          </div>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="text-sm text-muted uppercase tracking-wide font-bold">Trimestres à récupérer (est.)</div>
            <div className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>+{anomalies.reduce((acc, a) => acc + (a.trimesters?.includes('0') || a.trimesters?.includes('1') || a.trimesters?.includes('2') || a.trimesters?.includes('3') ? 1 : 0), 0)}</div>
          </div>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="text-sm text-muted uppercase tracking-wide font-bold">Justificatifs requis</div>
            <div className="text-3xl font-bold text-warning">{anomalies.length}</div>
          </div>
        </div>

        {/* Anomalies Details */}
        <div className="flex flex-col gap-6 mt-4">
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '1rem' }}>
            <FileSearch className="text-primary" />
            Détail des anomalies {results ? '(Données réelles)' : '(Exemple)'}
          </h2>

          {anomalies.map((anom, idx) => (
            <div key={idx} className="card" style={{ padding: '0', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '1.5rem', background: 'var(--bg-card-hover)', borderBottom: '1px solid rgba(0,0,0,0.05)' }} className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div style={{ background: 'var(--error-bg)', color: 'var(--error)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Année {anom.year} - {anom.employer || 'Inconnu'}</h3>
                  </div>
                </div>
                <div className="badge badge-error">Anomalie confirmée</div>
              </div>
              
              {/* Body */}
              <div style={{ padding: '1.5rem' }} className="flex flex-col gap-6">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', background: 'var(--bg-page)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div className="text-xs text-muted">Salaire Brut (ou nature)</div>
                    <div className="font-semibold">{anom.salary || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Trimestres validés</div>
                    <div className="font-semibold">{anom.trimesters}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Points Agirc-Arrco</div>
                    <div className="font-semibold">{anom.points || '0.00'}</div>
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
                  <p className="text-sm font-medium mb-4">{anom.solution || "Contacter la caisse de retraite pour régularisation."}</p>
                  
                  {anom.docs && (
                    <>
                      <div className="text-sm font-bold uppercase tracking-wider text-success mb-2" style={{ opacity: 0.8 }}>Pièces justificatives à fournir :</div>
                      <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        {anom.docs.map((doc, docIdx) => (
                          <li key={docIdx} style={{ marginBottom: '0.25rem' }}>{doc}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
