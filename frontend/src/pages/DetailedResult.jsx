import { useAuth } from '../context/AuthContext'
import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import html2pdf from 'html2pdf.js'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import JustificatifsBlock from '../components/JustificatifsBlock'

export default function DetailedResult({ result, onReset, onRefresh }) {
  const { user } = useAuth()
  const contentRef = useRef(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Helper to clean text (strip Markdown asterisks and ensure lists are on new lines)
  const cleanText = (text) => {
    if (!text) return ""
    return String(text)
      .replace(/\*\*/g, '')
      .replace(/([^>\r\n])•/g, '$1\n•') // Add newline before bullet if not already there
      .replace(/\n\n+/g, '\n')
      .trim()
  }

  // Auto-refresh when analysis is missing
  useEffect(() => {
    let interval;
    if (result && !result.ai_analysis) {
      interval = setInterval(() => {
        if (onRefresh) onRefresh();
      }, 5000); // Poll every 5 seconds
    }
    return () => clearInterval(interval);
  }, [result?.ai_analysis, onRefresh]);

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return
    setIsExporting(true)
    const element = contentRef.current
    const opt = {
      margin: [15, 12, 15, 12],
      filename: `Rapport_expertise_RIS_${new Date().toISOString().split('T')[0]}.pdf`,
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
            * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important; color: #1e1b4b !important; }
            .page { padding: 0 !important; background: #fff !important; }
            .container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
            .card { border: none !important; box-shadow: none !important; background: #fff !important; padding: 0 !important; color: #1e1b4b !important; }
            .bg-dots, .navbar, .btn, .delete-scan-btn, .badge-success { display: none !important; }
            h1 { font-size: 28pt !important; color: #1e1b4b !important; margin-bottom: 8pt !important; text-align: center !important; }
            h3 { font-size: 16pt !important; color: #1e1b4b !important; border-bottom: 2px solid #e2e8f0 !important; padding-bottom: 8pt !important; margin-top: 24pt !important; }
            h4 { font-size: 12pt !important; color: #4338ca !important; margin-bottom: 8pt !important; }
            .justificatif-box { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 6pt !important; padding: 12pt !important; margin-bottom: 15pt !important; color: #1e1b4b !important; }
            .anomaly-card { page-break-inside: avoid !important; margin-bottom: 20pt !important; border: 1px solid #f1f5f9 !important; border-radius: 8pt !important; padding: 15pt !important; background: #fff !important; color: #1e1b4b !important; }
            .pdf-header { display: flex !important; justify-content: space-between; align-items: center; border-bottom: 3px solid #4338ca; padding-bottom: 15pt; margin-bottom: 30pt; }
            .pdf-footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 9pt; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10pt; }
          `
          doc.head.appendChild(style)
          const content = doc.querySelector('.card')
          if (content) {
            const header = doc.createElement('div')
            header.className = 'pdf-header'
            header.innerHTML = `<div style="font-weight: 800; font-size: 14pt; color: #4338ca;">HOLOGRAM CONSEILS</div><div style="text-align: right; font-size: 10pt; color: #64748b;"><strong>Rapport d'expertise Retraite</strong><br/>Émis le ${new Date().toLocaleDateString('fr-FR')}</div>`
            content.prepend(header)
            const footer = doc.createElement('div')
            footer.className = 'pdf-footer'
            footer.innerHTML = `Hologram Conseils - expertise RIS - Document confidentiel`
            content.appendChild(footer)
          }
        }
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }
    try {
      await html2pdf().set(opt).from(element).save()
    } catch (err) {
      console.error("PDF generation failed", err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadWord = async () => {
    setIsExporting(true)
    try {
      let aiData = null
      try { 
        if (result?.ai_analysis) {
          aiData = typeof result.ai_analysis === 'string' ? JSON.parse(result.ai_analysis) : result.ai_analysis
        }
      } catch { aiData = null }

      const children = []
      children.push(new Paragraph({ text: "RAPPORT D'EXPERTISE RETRAITE - RIS PRO", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 400 } }))
      children.push(new Paragraph({ text: `Émis le ${new Date().toLocaleDateString('fr-FR')}`, alignment: AlignmentType.RIGHT, spacing: { after: 600 } }))

      if (aiData) {
        children.push(new Paragraph({ text: "SYNTHÈSE DU DOSSIER", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))
        children.push(new Paragraph({ children: [new TextRun({ text: "Niveau de risque détecté : ", bold: true }), new TextRun({ text: cleanText(aiData.niveau_risque || 'Non défini').toUpperCase(), color: aiData.niveau_risque === 'élevé' ? 'FF0000' : '000000' })], spacing: { after: 200 } }))
        if (aiData.resume_global) {
          children.push(new Paragraph({ text: cleanText(aiData.resume_global), spacing: { after: 400 }, alignment: AlignmentType.JUSTIFIED }))
        }
        if (aiData.full_timeline) {
          aiData.full_timeline.forEach(item => {
            if (!item) return
            const isAnom = String(item.statut || '').toLowerCase() !== 'complet'
            children.push(new Paragraph({ children: [new TextRun({ text: `ANNÉE ${item.annee}`, bold: true }), new TextRun({ text: ` - ${String(item.statut || '').toUpperCase()}` }), new TextRun({ text: ` (${item.trimestres_valides}/4 trim. | ${item.activite || 'N/A'})`, italics: true }), item.points_complementaires ? new TextRun({ text: ` | Points: ${item.points_complementaires}`, bold: true, color: "4F46E5" }) : new TextRun({ text: "" })], spacing: { before: 200, after: 100 } }))
            if (isAnom) {
              children.push(new Paragraph({ children: [new TextRun({ text: "⚠️ Anomalie : ", bold: true, color: "EAB308" }), new TextRun({ text: cleanText(item.anomalie_specifique || "Régularisation requise") })], spacing: { after: 80 } }))
              if (item.justificatif_suggere) {
                children.push(new Paragraph({ children: [new TextRun({ text: "📄 Justificatif(s) à fournir : ", bold: true, color: "4F46E5" }), new TextRun({ text: cleanText(item.justificatif_suggere) })], spacing: { after: 200 } }))
              }
              if (item.needs_justificatifs) {
                children.push(new Paragraph({ children: [new TextRun({ text: "📄 Justificatifs : ", bold: true, color: "4F46E5" }), new TextRun({ text: "Veuillez fournir une attestation sur l’honneur d’activité ou de non-activité, ainsi que les justificatifs cohérents avec le contenu de cette attestation lorsque l’analyse détecte des éléments manquants dans votre carrière." })], spacing: { after: 200 } }))
              }
            }
          })
        }
      }

      const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }] })
      const blob = await Packer.toBlob(doc)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = `Rapport_expert_RIS_${new Date().toISOString().split('T')[0]}.docx`; a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Word generation failed", err)
    } finally {
      setIsExporting(false)
    }
  }

  let aiData = null
  try { 
    if (result?.ai_analysis) {
      aiData = typeof result.ai_analysis === 'string' ? JSON.parse(result.ai_analysis) : result.ai_analysis
    }
  } catch (e) { aiData = null }

  const riskColors = {
    'faible': { bg: 'rgba(34,197,94,0.1)', text: '#22c55e', icon: '🟢' },
    'moyen': { bg: 'rgba(234,179,8,0.1)', text: '#eab308', icon: '🟡' },
    'élevé': { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', icon: '🔴' },
  }
  const riskKey = String(aiData?.niveau_risque || 'moyen').toLowerCase().trim()
  const risk = riskColors[riskKey] || riskColors['moyen']

  if (!result) return null

  return (
    <div className="page" style={{ paddingBottom: 100 }}>
      <div className="bg-dots" />
      <div className="container" style={{ maxWidth: 740, position: 'relative' }}>
        {document.getElementById('navbar-portal-root') && createPortal(
          <>
            <button className="btn btn-secondary btn-nav" onClick={handleDownloadWord} disabled={isExporting}>{isExporting ? '⌛' : '📄'} Word</button>
            <button className="btn btn-secondary btn-nav" onClick={handleDownloadPDF} disabled={isExporting}>{isExporting ? '⌛' : '📥'} PDF</button>
          </>,
          document.getElementById('navbar-portal-root')
        )}
        
        <div ref={contentRef} className="card shadow-expert" style={{ background: 'var(--bg-card)', padding: '40px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(79,70,229,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 40 }}>📊</div>
            <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 12, letterSpacing: -1 }}>Rapport d'expertise RIS</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 18 }}>Analyse exhaustive de votre situation de retraite</p>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12 }}>
              <span className="badge badge-success">✦ Accès Expert Illimité</span>
              {result.is_scanned && <span className="badge badge-warning">📄 Document Scanné</span>}
            </div>
          </div>

          {aiData && (
            <div style={{ marginBottom: 48 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 15, borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Analyse de l'expert retraite</h3>
                <div style={{ background: risk.bg, color: risk.text, padding: '6px 16px', borderRadius: 50, fontWeight: 800, fontSize: 13, border: `1px solid ${risk.text}33` }}>
                  {risk.icon} RISQUE {String(aiData.niveau_risque || 'moyen').toUpperCase()}
                </div>
              </div>
              <div className="justificatif-box" style={{ background: 'rgba(255,255,255,0.02)', marginBottom: 24 }}>
                 <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                   {cleanText(aiData.resume_global || aiData.resume || "Synthèse en cours de finalisation...")}
                 </p>
              </div>
              {(aiData.compte_rendu || aiData.analyse_detaillee) && (
                <div style={{ padding: '20px', borderRadius: 12, background: 'rgba(79,70,229,0.03)', borderLeft: '4px solid var(--primary-light)' }}>
                  <h4 style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary-light)', marginBottom: 12 }}>📝 Synthèse détaillée</h4>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {cleanText(aiData.compte_rendu || aiData.analyse_detaillee)}
                  </p>
                </div>
              )}
            </div>
          )}

          <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>🔎 Chronologie et Pièces Justificatives</h3>
          
          {!result.ai_analysis && (
            <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
              <div className="spinner" style={{ margin: '0 auto 16px', borderColor: isRefreshing ? 'var(--primary-light) transparent transparent transparent' : '' }} />
              <p style={{ fontWeight: 600 }}>{isRefreshing ? "Mise à jour..." : "L'expert analyse votre document..."}</p>
              <button className={`btn ${isRefreshing ? 'btn-secondary' : 'btn-primary'} btn-sm`} style={{ marginTop: 16 }} disabled={isRefreshing} onClick={() => { setIsRefreshing(true); onRefresh().finally(() => setTimeout(() => setIsRefreshing(false), 800)) }}>
                {isRefreshing ? 'Recherche...' : '🔄 Rafraîchir'}
              </button>
            </div>
          )}

          {aiData?.full_timeline && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {aiData.full_timeline.map((item, i) => {
                if (!item) return null
                const qCount = parseInt(item.trimestres_valides) || 0
                let stat = String(item.statut || '').toLowerCase()
                if (qCount === 4) stat = 'complet'
                else if (qCount > 0) stat = 'incomplet'
                else stat = 'manquant'
                const borderColor = stat === 'complet' ? 'var(--success)' : (stat === 'manquant' ? 'var(--danger)' : 'var(--warning)')
                const isErr = stat !== 'complet'
                
                return (
                  <div key={i} className="anomaly-card" style={{ borderLeft: `5px solid ${borderColor}`, background: isErr ? 'rgba(255,255,255,0.03)' : 'transparent', padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: 18, fontWeight: 800 }}>ANNÉE {item.annee}</span>
                        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{cleanText(item.activite || 'N/A')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: borderColor, fontWeight: 800, fontSize: 13 }}>{stat.toUpperCase()}</div>
                        <div style={{ fontSize: 12 }}>{item.trimestres_valides}/4 trim.</div>
                        {item.points_complementaires != null && <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: 'var(--primary-light)', background: 'rgba(79,70,229,0.08)', padding: '2px 8px', borderRadius: 4 }}>🪙 {String(item.points_complementaires)} pts</div>}
                      </div>
                    </div>
                    {isErr && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ padding: '12px', borderRadius: 8, background: 'rgba(234,179,8,0.05)', color: 'var(--warning)', fontWeight: 600, marginBottom: 12 }}>⚠️ {cleanText(item.anomalie_specifique || "Régularisation requise")}</div>
                        {item.justificatif_suggere && (
                          <div className="justificatif-box" style={{ borderColor: 'var(--primary-light)', padding: '16px' }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary-light)', textTransform: 'uppercase', marginBottom: 6 }}>📄 Justificatif(s) :</div>
                            <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'pre-wrap' }}>{cleanText(item.justificatif_suggere)}</div>
                          </div>
                        )}
                        {item.needs_justificatifs && <JustificatifsBlock />}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <button className="btn btn-secondary" onClick={onReset}>← Analyser un autre RIS</button>
        </div>
      </div>
    </div>
  )
}
