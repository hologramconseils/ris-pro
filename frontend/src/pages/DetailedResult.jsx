import { useAuth } from '../context/AuthContext'
import { useRef, useState } from 'react'
import html2pdf from 'html2pdf.js'

export default function DetailedResult({ result, onReset }) {
  const { user } = useAuth()
  const contentRef = useRef(null)
  const [isExporting, setIsExporting] = useState(false)
  let anomalies = []
  try {
    anomalies = JSON.parse(result.detailed_report || '[]')
  } catch { anomalies = [] }

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return
    setIsExporting(true)
    const element = contentRef.current
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `Rapport_RIS_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }
    await html2pdf().set(opt).from(element).save()
    setIsExporting(false)
  }

  const handleDownloadWord = () => {
    if (!contentRef.current) return
    setIsExporting(true)
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
      "xmlns:w='urn:schemas-microsoft-com:office:word' " +
      "xmlns='http://www.w3.org/TR/REC-html40'>" +
      "<head><meta charset='utf-8'><title>Rapport RIS</title>" +
      "<style>body { font-family: Arial, sans-serif; font-size: 11pt; } .card { border: 1px solid #ccc; padding: 15px; margin-bottom: 20px; } .badge { font-weight: bold; } h1, h2, h3, h4 { color: #333; } p { color: #555; }</style>" +
      "</head><body>"
    const footer = "</body></html>"
    const sourceHTML = header + contentRef.current.innerHTML + footer

    const blob = new Blob(['\ufeff', sourceHTML], {
      type: 'application/msword'
    })
    const url = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML)
    const filename = `Rapport_RIS_${new Date().toISOString().split('T')[0]}.doc`
    
    const downloadLink = document.createElement("a")
    document.body.appendChild(downloadLink)
    
    if (navigator.msSaveOrOpenBlob) {
      navigator.msSaveOrOpenBlob(blob, filename)
    } else {
      downloadLink.href = url
      downloadLink.download = filename
      downloadLink.click()
    }
    
    document.body.removeChild(downloadLink)
    setIsExporting(false)
  }

  return (
    <div className="page">
      <div className="bg-dots" />
      <div className="container" style={{ maxWidth: 740, position: 'relative' }}>
        
        {/* Export Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginBottom: 16 }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleDownloadWord} 
            disabled={isExporting}
            style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {isExporting ? '⏳' : '📄'} Télécharger Word
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleDownloadPDF} 
            disabled={isExporting}
            style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {isExporting ? '⏳' : '📥'} Télécharger PDF
          </button>
        </div>

        {/* Content to Export */}
        <div ref={contentRef} style={{ background: 'var(--bg)', borderRadius: 12, padding: '10px 0' }}>
          {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <span style={{ fontSize: 56 }}>📊</span>
          <h1 style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1, marginTop: 12, marginBottom: 8 }}>
            Rapport Détaillé
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
            {anomalies.length} anomalie{anomalies.length > 1 ? 's' : ''} identifiée{anomalies.length > 1 ? 's' : ''} dans votre relevé de carrière
          </p>
          {user && (
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 8 }}>
              <span className="badge badge-success">✦ Accès Pro activé</span>
              {result.is_scanned && <span className="badge badge-warning">📄 Scan détecté</span>}
              {!result.is_valid_ris && !result.is_scanned && <span className="badge badge-warning">❓ Format non-standard</span>}
            </div>
          )}
        </div>

        {/* Summary card */}
        <div className="card" style={{ marginBottom: 24, background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 40 }}>⚠️</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
                {anomalies.length} anomalie{anomalies.length > 1 ? 's' : ''} nécessite{anomalies.length > 1 ? 'nt' : ''} votre attention
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                Ces anomalies pourraient réduire le montant de votre retraite ou retarder votre départ.
                Nous vous recommandons de contacter votre caisse de retraite pour régularisation.
              </p>
            </div>
          </div>
        </div>

        {/* AI Expert Audit */}
        {result.ai_analysis && (() => {
          let aiData = null
          try {
            aiData = JSON.parse(result.ai_analysis)
          } catch { aiData = null }

          const riskColors = {
            'faible': { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#22c55e', label: '🟢 Risque faible' },
            'moyen': { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#eab308', label: '🟡 Risque moyen' },
            'élevé': { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444', label: '🔴 Risque élevé' },
          }

          if (aiData && (aiData.resume_global || aiData.compte_rendu)) {
            const risk = riskColors[aiData.niveau_risque] || riskColors['moyen']
            const timeline = aiData.full_timeline || []
            const incompleteYears = timeline.filter(y => y.statut !== 'complet')

            const sectionStyle = {
              background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '12px 16px',
              marginBottom: 16
            }

            return (
              <div className="card" style={{ 
                marginBottom: 32, 
                background: 'linear-gradient(135deg, rgba(79,70,229,0.08), rgba(6,182,212,0.08))',
                borderColor: 'var(--primary-light)',
                position: 'relative',
                overflow: 'hidden'
              }}>


                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                    🧪 Diagnostic Expert <span className="badge badge-success" style={{ fontSize: 10 }}>Bêta</span>
                  </h3>
                  <span style={{ 
                    padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700,
                    background: risk.bg, border: `1px solid ${risk.border}`, color: risk.text
                  }}>
                    {risk.label}
                  </span>
                </div>

                {/* Summary */}
                {aiData.resume_global && (
                  <div style={{ ...sectionStyle, borderLeft: `3px solid ${risk.border}` }}>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text)' }}>
                      {aiData.resume_global}
                    </p>
                  </div>
                )}

                {/* Summary Stats */}
                <div style={{ ...sectionStyle, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Période analysée</div>
                    <div style={{ fontWeight: 700 }}>{aiData.premiere_annee} - {aiData.derniere_annee}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Années avec anomalies</div>
                    <div style={{ fontWeight: 700, color: incompleteYears.length > 0 ? '#ef4444' : 'inherit' }}>
                      {incompleteYears.length}
                    </div>
                  </div>
                </div>

                {/* Compte-rendu */}
                {aiData.compte_rendu && (
                  <div style={{ ...sectionStyle, borderLeft: '3px solid var(--primary-light)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--primary-light)' }}>
                      📝 Rapport d'expertise détaillé
                    </h4>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                      {aiData.compte_rendu.replace(/\*\*/g, '')}
                    </p>
                  </div>
                )}

                <p style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 12 }}>
                  ℹ️ Cette analyse est générée automatiquement par notre algorithme de pointe et doit être validée par un conseiller.
                </p>
              </div>
            )
          }

          // Fallback raw text
          return (
            <div className="card" style={{ marginBottom: 32 }}>
               <h3>🧪 Diagnostic Expert</h3>
               <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{result.ai_analysis.replace(/\*\*/g, '')}</pre>
            </div>
          )
        })()}

        {/* List of anomalies / Full Timeline */}
        <div className="anomaly-list">
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20, marginTop: 40, letterSpacing: -0.5 }}>
            🔎 Chronologie détaillée
          </h2>

          {(() => {
            let aiData = null
            try { aiData = JSON.parse(result.ai_analysis) } catch { aiData = null }

            // If we have AI timeline, use it as source of truth for coherence
            if (aiData && aiData.full_timeline) {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {aiData.full_timeline.map((item, i) => {
                    const isWarning = item.statut !== 'complet'
                    const borderColor = item.statut === 'complet' ? '#22c55e' : (item.statut === 'manquant' ? '#ef4444' : '#eab308')
                    const badgeClass = item.statut === 'complet' ? 'badge-success' : 'badge-danger'
                    
                    return (
                      <div key={i} className="anomaly-card" style={{
                        borderLeft: `4px solid ${borderColor}`,
                        background: isWarning ? 'rgba(239,68,68,0.02)' : 'rgba(255,255,255,0.02)'
                      }}>
                        <div className="anomaly-header">
                          <span className={`badge ${badgeClass}`} style={{ textTransform: 'capitalize' }}>
                            {item.statut}
                          </span>
                          <span className="anomaly-id">Année {item.annee}</span>
                        </div>
                        <h3 className="anomaly-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Année {item.annee} : {item.trimestres_valides}/4 trimestres</span>
                          {item.points_complementaires && (
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
                              {item.points_complementaires} pts
                            </span>
                          )}
                        </h3>
                        <p className="anomaly-desc">
                          <span style={{ color: 'var(--text-muted)' }}>Activité :</span> {item.activite}
                        </p>
                        {isWarning && (
                          <div style={{ 
                            marginTop: 12, padding: '10px 14px', borderRadius: 8, 
                            background: item.statut === 'manquant' ? 'rgba(239,68,68,0.08)' : 'rgba(234,179,8,0.08)',
                            border: `1px solid ${item.statut === 'manquant' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)'}`,
                            fontSize: 14, color: item.statut === 'manquant' ? '#ef4444' : '#eab308', fontWeight: 600
                          }}>
                            ⚠️ {item.anomalie_specifique || `Il manque ${item.trimestres_manquants} trimestre(s) sur cette année.`}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            }

            // Fallback to basic anomalies cards if no AI timeline
            return anomalies.map((a, i) => (
              <div key={i} className="anomaly-card border-danger">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className="badge badge-danger">Anomalie {i + 1}</span>
                </div>
                <h4>{a.title}</h4>
                <p>{a.description}</p>
              </div>
            ))
          })()}
        </div>
        </div> {/* End of Export Content */}

        {/* Actions (Not Exported) */}
        <div className="card" style={{ marginTop: 28, textAlign: 'center' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>💼 Besoin d'accompagnement ?</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
            Nos conseillers chez Hologram Conseils peuvent vous aider à régulariser ces anomalies
            et optimiser votre départ en retraite.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://www.hologramconseils.com/contact/"
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              🤝 Prendre rendez-vous
            </a>
            <button className="btn btn-secondary btn-sm" onClick={onReset}>
              ← Analyser un autre fichier
            </button>
          </div>
        </div>

        {/* Lifetime access reminder */}
        <div style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-subtle)', fontSize: 13 }}>
          🔄 Votre accès est à vie — revenez analyser votre RIS chaque année sans frais supplémentaires.
        </div>
      </div>
    </div>
  )
}
