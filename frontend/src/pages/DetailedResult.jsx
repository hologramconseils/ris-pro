import { useAuth } from '../context/AuthContext'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import html2pdf from 'html2pdf.js'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'

export default function DetailedResult({ result, onReset, onRefresh }) {
  const { user } = useAuth()
  const contentRef = useRef(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  let anomalies = []
  try {
    anomalies = JSON.parse(result.detailed_report || '[]')
  } catch { anomalies = [] }

  const handleDownloadPDF = async () => {
    setIsExporting(true)
    const element = contentRef.current
    const opt = {
      margin: [15, 12, 15, 12],
      filename: `Rapport_Expertise_RIS_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true,
        logging: false,
        onclone: (doc) => {
          const style = doc.createElement('style')
          style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important; }
            .page { padding: 0 !important; background: #fff !important; }
            .container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
            .card { border: none !important; box-shadow: none !important; background: #fff !important; padding: 0 !important; }
            .bg-dots, .navbar, .btn, .delete-scan-btn, .badge-success { display: none !important; }
            
            h1 { font-size: 28pt !important; color: #1e1b4b !important; margin-bottom: 8pt !important; text-align: center !important; }
            h3 { font-size: 16pt !important; color: #1e1b4b !important; border-bottom: 2px solid #e2e8f0 !important; padding-bottom: 8pt !important; margin-top: 24pt !important; }
            h4 { font-size: 12pt !important; color: #4338ca !important; margin-bottom: 8pt !important; }
            
            .justificatif-box { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 6pt !important; padding: 12pt !important; margin-bottom: 15pt !important; }
            .anomaly-card { page-break-inside: avoid !important; margin-bottom: 20pt !important; border: 1px solid #f1f5f9 !important; border-radius: 8pt !important; padding: 15pt !important; background: #fff !important; }
            .anomaly-id { color: #1e1b4b !important; }
            
            .pdf-header { display: flex !important; justify-content: space-between; align-items: center; border-bottom: 3px solid #4338ca; padding-bottom: 15pt; margin-bottom: 30pt; }
            .pdf-footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 9pt; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10pt; }
          `
          doc.head.appendChild(style)

          const content = doc.querySelector('.card')
          
          // Create Professional Header
          const header = doc.createElement('div')
          header.className = 'pdf-header'
          header.innerHTML = `
            <div style="font-weight: 800; font-size: 14pt; color: #4338ca;">HOLOGRAM CONSEILS</div>
            <div style="text-align: right; font-size: 10pt; color: #64748b;">
              <strong>Rapport d'Expertise Retraite</strong><br/>
              Émis le ${new Date().toLocaleDateString('fr-FR')}
            </div>
          `
          content.prepend(header)

          // Add Footer
          const footer = doc.createElement('div')
          footer.className = 'pdf-footer'
          footer.innerHTML = `Hologram Conseils - Expertise RIS - Document confidentiel - Page 1`
          content.appendChild(footer)
          
          // Refine text colors for print
          doc.querySelectorAll('p, span, div').forEach(el => {
            if (!el.classList.contains('badge')) {
              el.style.color = '#334155'
            }
          })
          
          // Specific adjustments for risk badges in PDF
          doc.querySelectorAll('.badge-warning').forEach(b => {
             b.style.background = '#fef3c7'
             b.style.color = '#92400e'
             b.style.border = '1px solid #f59e0b'
             b.style.display = 'inline-block'
             b.style.padding = '4px 10px'
             b.style.borderRadius = '20px'
          })
        }
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }

    try {
      await html2pdf().set(opt).from(element).save()
    } catch (err) {
      alert("Erreur lors de la génération du PDF.")
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadWord = async () => {
    setIsExporting(true)
    try {
      let aiData = null
      try { aiData = JSON.parse(result.ai_analysis) } catch { aiData = null }

      const children = []
      children.push(
        new Paragraph({
          text: "RAPPORT D'EXPERTISE RETRAITE - RIS PRO",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      )

      children.push(
        new Paragraph({
          text: `Émis le ${new Date().toLocaleDateString('fr-FR')}`,
          alignment: AlignmentType.RIGHT,
          spacing: { after: 600 },
        })
      )

      if (aiData) {
        children.push(
          new Paragraph({
            text: "SYNTHÈSE DU DOSSIER",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        )

        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Niveau de risque détecté : ", bold: true }),
              new TextRun({ text: (aiData.niveau_risque || 'Non défini').toUpperCase(), color: aiData.niveau_risque === 'élevé' ? 'FF0000' : '000000' }),
            ],
            spacing: { after: 200 },
          })
        )

        if (aiData.resume_global) {
          children.push(new Paragraph({ text: aiData.resume_global, spacing: { after: 400 }, alignment: AlignmentType.JUSTIFIED }))
        }

        children.push(
          new Paragraph({
            text: "CHRONOLOGIE ET PIÈCES À FOURNIR",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 300 },
          })
        )

        if (aiData.full_timeline) {
          aiData.full_timeline.forEach(item => {
            const isAnom = item.statut !== 'complet'
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `ANNÉE ${item.annee}`, bold: true }),
                  new TextRun({ text: ` - ${item.statut.toUpperCase()}` }),
                  new TextRun({ text: ` (${item.trimestres_valides}/4 trim. | ${item.activite || 'N/A'})`, italics: true }),
                ],
                spacing: { before: 200, after: 100 },
              })
            )
            
            if (isAnom) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: "⚠️ Anomalie : ", bold: true, color: "EAB308" }),
                    new TextRun({ text: item.anomalie_specifique || "Trimestres manquants" }),
                  ],
                  spacing: { after: 80 },
                })
              )
              
              if (item.justificatif_suggere) {
                children.push(
                  new Paragraph({
                    children: [
                      new TextRun({ text: "📄 Justificatif(s) à fournir : ", bold: true, color: "4F46E5" }),
                      new TextRun({ text: item.justificatif_suggere, bold: true }),
                    ],
                    spacing: { after: 200 },
                  })
                )
              }
            }
          })
        }
      }

      const doc = new Document({
        sections: [{
          properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
          children: children
        }]
      })

      const blob = await Packer.toBlob(doc)
      const url = window.URL.createObjectURL(blob)
      const downloadLink = document.createElement("a")
      downloadLink.href = url
      downloadLink.download = `Rapport_Expert_RIS_${new Date().toISOString().split('T')[0]}.docx`
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert("Une erreur est survenue lors de la génération du document Word.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="page" style={{ paddingBottom: 100 }}>
      <div className="bg-dots" />
      <div className="container" style={{ maxWidth: 740, position: 'relative' }}>
        {/* Navbar Actions Portal */}
        {document.getElementById('navbar-portal-root') && createPortal(
          <>
            <button className="btn btn-secondary btn-nav" onClick={handleDownloadWord} disabled={isExporting}>
              {isExporting ? '⏳' : '📄'} Word
            </button>
            <button className="btn btn-secondary btn-nav" onClick={handleDownloadPDF} disabled={isExporting}>
              {isExporting ? '⏳' : '📥'} PDF
            </button>
          </>,
          document.getElementById('navbar-portal-root')
        )}
        

        {/* Content */}
        <div ref={contentRef} className="card shadow-expert" style={{ background: 'var(--bg-card)', padding: '40px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ 
              width: 80, height: 80, borderRadius: '50%', background: 'rgba(79,70,229,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              fontSize: 40
            }}>
              📊
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 12, letterSpacing: -1 }}>Rapport d'Expertise RIS</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 18 }}>Analyse exhaustive de votre situation de retraite</p>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12 }}>
              <span className="badge badge-success">✦ Accès Expert Illimité</span>
              {result.is_scanned && <span className="badge badge-warning">📄 Document Scanné</span>}
            </div>
          </div>

          {/* AI Diagnostic */}
          {result.ai_analysis && (() => {
            let aiData = null
            try { aiData = JSON.parse(result.ai_analysis) } catch { aiData = null }
            if (!aiData) return null

            const riskColors = {
              'faible': { bg: 'rgba(34,197,94,0.1)', text: '#22c55e', icon: '🟢' },
              'moyen': { bg: 'rgba(234,179,8,0.1)', text: '#eab308', icon: '🟡' },
              'élevé': { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', icon: '🔴' },
            }
            const risk = riskColors[aiData.niveau_risque] || riskColors['moyen']

            return (
              <div style={{ marginBottom: 48 }}>
                <div style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  marginBottom: 20, paddingBottom: 15, borderBottom: '1px solid var(--border)' 
                }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>🧠 Analyse de l'expert retraite</h3>
                  <div style={{ 
                    background: risk.bg, color: risk.text, padding: '6px 16px', 
                    borderRadius: 50, fontWeight: 800, fontSize: 13, border: `1px solid ${risk.text}33`
                  }}>
                    {risk.icon} RISQUE {aiData.niveau_risque.toUpperCase()}
                  </div>
                </div>

                <div className="justificatif-box" style={{ background: 'rgba(255,255,255,0.02)', marginBottom: 24 }}>
                   <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{aiData.resume_global}</p>
                </div>

                {aiData.compte_rendu && (
                  <div style={{ 
                    padding: '20px', borderRadius: 12, background: 'rgba(79,70,229,0.03)', 
                    borderLeft: '4px solid var(--primary-light)'
                  }}>
                    <h4 style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary-light)', marginBottom: 12 }}>
                      📝 Synthèse détaillée de l'expert retraite
                    </h4>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {aiData.compte_rendu.replace(/\*\*/g, '')}
                    </p>
                  </div>
                )}
              </div>
            )
          })()}

            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>🔎 Chronologie et Pièces Justificatives</h3>
            
            {(() => {
              let aiData = null
              try { aiData = JSON.parse(result.ai_analysis) } catch { aiData = null }
              
              if (!result.ai_analysis) return (
                <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
                  {!isRefreshing && <div className="spinner" style={{ margin: '0 auto 16px' }}></div>}
                  {isRefreshing && <div className="spinner" style={{ margin: '0 auto 16px', borderColor: 'var(--primary-light) transparent transparent transparent' }}></div>}
                  
                  <p style={{ fontWeight: 600 }}>
                    {isRefreshing ? "Mise à jour de l'expertise..." : "L'expert retraite analyse votre document en arrière-plan..."}
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-subtle)' }}>
                    Cela peut prendre jusqu'à 1 minute.
                  </p>
                  
                  <button 
                    className={`btn ${isRefreshing ? 'btn-secondary' : 'btn-primary'} btn-sm`} 
                    style={{ marginTop: 16, minWidth: 180 }} 
                    disabled={isRefreshing}
                    onClick={async () => {
                      if (!onRefresh) {
                        window.location.reload()
                        return
                      }
                      setIsRefreshing(true)
                      try {
                        await onRefresh()
                      } finally {
                        // Give a small delay for smoother transition
                        setTimeout(() => setIsRefreshing(false), 800)
                      }
                    }}
                  >
                    {isRefreshing ? '⌛ Recherche...' : '🔄 Rafraîchir l\'expertise'}
                  </button>
                </div>
              )

              if (!aiData?.full_timeline) return (
                <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,100,100,0.05)', borderRadius: 12 }}>
                  <p style={{ fontWeight: 600, color: 'var(--danger)' }}>⚠️ Chronologie indisponible</p>
                  <p style={{ fontSize: 13, color: 'var(--text-subtle)' }}>L'analyse détaillée n'a pas pu être générée pour ce document ou le format est obsolète.</p>
                </div>
              )

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {aiData.full_timeline.map((item, i) => {
                    // Normalization fail-safe: Ensure status matches quarter count regardless of AI output
                    const qCount = parseInt(item.trimestres_valides) || 0
                    let actualStatut = item.statut?.toLowerCase()
                    
                    if (qCount === 4) actualStatut = 'complet'
                    else if (qCount > 0) actualStatut = 'incomplet'
                    else actualStatut = 'manquant'

                    const isError = actualStatut !== 'complet'
                    const borderColor = actualStatut === 'complet' ? 'var(--success)' : (actualStatut === 'manquant' ? 'var(--danger)' : 'var(--warning)')
                    
                    return (
                      <div key={i} className="anomaly-card" style={{ 
                        borderLeft: `5px solid ${borderColor}`,
                        background: isError ? 'rgba(255,255,255,0.03)' : 'transparent',
                        padding: '24px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div>
                            <span className="anomaly-id" style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>ANNÉE {item.annee}</span>
                            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
                              {item.activite || 'Activité non spécifiée'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: borderColor, fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>{actualStatut}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{item.trimestres_valides}/4 trimestres</div>
                            {item.points_complementaires !== undefined && (
                              <div style={{ 
                                marginTop: 4, fontSize: 11, fontWeight: 700, 
                                color: 'var(--primary-light)', background: 'rgba(79,70,229,0.08)',
                                padding: '2px 8px', borderRadius: 4, display: 'inline-block'
                              }}>
                                🪙 {item.points_complementaires} points
                              </div>
                            )}
                          </div>
                        </div>

                        {isError && (
                          <div style={{ marginTop: 16 }}>
                            <div style={{ 
                              padding: '12px 16px', borderRadius: 8, 
                              background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.1)',
                              fontSize: 14, color: 'var(--warning)', fontWeight: 600, marginBottom: 12
                            }}>
                              ⚠️ {item.anomalie_specifique || "Régularisation requise"}
                            </div>
                            
                            {item.justificatif_suggere && (
                              <div className="justificatif-box" style={{ borderColor: 'var(--primary-light)', padding: '16px' }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary-light)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>
                                  📄 Justificatif(s) à fournir :
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                                  {item.justificatif_suggere}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

        {/* Footer actions */}
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <button className="btn btn-secondary" onClick={onReset}>
            ← Analyser un autre RIS
          </button>
        </div>
      </div>
    </div>
  )
}
