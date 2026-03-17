import { useAuth } from '../context/AuthContext'
import { useRef, useState } from 'react'
import html2pdf from 'html2pdf.js'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'

export default function DetailedResult({ result, onReset }) {
  const { user } = useAuth()
  const contentRef = useRef(null)
  const [isExporting, setIsExporting] = useState(false)
  let anomalies = []
  try {
    anomalies = JSON.parse(result.detailed_report || '[]')
  } catch { anomalies = [] }

  const handleDownloadPDF = async () => {
    setIsExporting(true)
    const element = contentRef.current
    const opt = {
      margin: 10,
      filename: `Rapport_Expertise_RIS_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true,
        onclone: (doc) => {
          const all = doc.querySelectorAll('*')
          all.forEach(el => {
            el.style.color = '#000000'
            el.style.background = '#ffffff'
            el.style.backgroundImage = 'none'
            el.style.boxShadow = 'none'
            el.style.textShadow = 'none'
            el.style.borderColor = '#000000'
          })
          doc.querySelectorAll('.btn, .delete-scan-btn, .bg-dots, .navbar').forEach(el => {
            el.style.display = 'none'
          })
          doc.querySelectorAll('h1, h2, h3, h4').forEach(h => {
             h.style.borderBottom = '1px solid #000'
             h.style.paddingBottom = '10px'
             h.style.marginBottom = '20px'
             h.style.textAlign = 'center'
             h.style.color = '#000'
          })
          // Special PDF styling for justificatif boxes
          doc.querySelectorAll('.justificatif-box').forEach(box => {
            box.style.border = '1px solid #ddd'
            box.style.padding = '10px'
            box.style.marginTop = '10px'
          })
        }
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }

    try {
      await html2pdf().set(opt).from(element).save()
    } catch (err) {
      console.error("PDF Export Error:", err)
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
      console.error("Error generating DOCX", err)
      alert("Une erreur est survenue lors de la génération du document Word.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="page" style={{ paddingBottom: 100 }}>
      <div className="bg-dots" />
      <div className="container" style={{ maxWidth: 740, position: 'relative' }}>
        
        {/* Actions Float */}
        <div style={{ position: 'sticky', top: 80, zIndex: 50, marginBottom: 24, display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm shadow-expert" onClick={handleDownloadWord} disabled={isExporting}>
            {isExporting ? '⏳' : '📄'} Word
          </button>
          <button className="btn btn-secondary btn-sm shadow-expert" onClick={handleDownloadPDF} disabled={isExporting}>
            {isExporting ? '⏳' : '📥'} PDF
          </button>
        </div>

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
                  <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>🧠 Analyse de l'Expert IA</h3>
                  <div style={{ 
                    background: risk.bg, color: risk.text, padding: '6px 16px', 
                    borderRadius: 50, fontWeight: 800, fontSize: 13, border: `1px solid ${risk.text}33`
                  }}>
                    {risk.icon} RISQUE {aiData.niveau_risque.toUpperCase()}
                  </div>
                </div>

                <div className="justificatif-box" style={{ background: 'rgba(255,255,255,0.02)', marginBottom: 24 }}>
                   <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6 }}>{aiData.resume_global}</p>
                </div>

                {aiData.compte_rendu && (
                  <div style={{ 
                    padding: '20px', borderRadius: 12, background: 'rgba(79,70,229,0.03)', 
                    borderLeft: '4px solid var(--primary-light)'
                  }}>
                    <h4 style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary-light)', marginBottom: 12 }}>
                      📝 Synthèse détaillée par l'expert
                    </h4>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {aiData.compte_rendu.replace(/\*\*/g, '')}
                    </p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Chronologie et Justificatifs */}
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>🔎 Chronologie et Pièces Justificatives</h3>
            
            {(() => {
              let aiData = null
              try { aiData = JSON.parse(result.ai_analysis) } catch { aiData = null }
              if (!aiData?.full_timeline) return <p>Chargement de la chronologie...</p>

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {aiData.full_timeline.map((item, i) => {
                    const isError = item.statut !== 'complet'
                    const borderColor = item.statut === 'complet' ? 'var(--success)' : (item.statut === 'manquant' ? 'var(--danger)' : 'var(--warning)')
                    
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
                            <div style={{ color: borderColor, fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>{item.statut}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{item.trimestres_valides}/4 trimestres</div>
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
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
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
