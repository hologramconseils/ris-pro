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
        <div ref={contentRef} className="card shadow-expert" style={{ background: 'var(--bg-card)', padding: '40px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(79,70,229,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 40 }}>📊</div>
            <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 12, letterSpacing: -1 }}>Expertise Algorithmique RIS</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 18 }}>Analyse certifiée de votre situation de retraite</p>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                <span className="badge badge-success">✦ Accès Expert Illimité</span>
                {result.is_scanned && <span className="badge badge-warning">📄 Document Scanné</span>}
              </div>
              <button 
                className="btn btn-primary shadow-glow" 
                onClick={handleDownloadWord} 
                disabled={isExporting}
                style={{ width: 'fit-content', padding: '12px 32px', borderRadius: '50px' }}
              >
                {isExporting ? 'Génération...' : 'Télécharger l’extraction DOC / Word'}
              </button>
            </div>
          </div>

          {aiData && (
            <div style={{ marginBottom: 48 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 15, borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Analyse de l'expert retraite</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                  <div style={{ background: 'rgba(79,70,229,0.1)', color: 'var(--primary-light)', padding: '6px 16px', borderRadius: 50, fontWeight: 800, fontSize: 13, border: '1px solid var(--primary-light)33' }}>
                    🎯 FIABILITÉ : {result.reliability_score}%
                  </div>
                  <div style={{ background: risk.bg, color: risk.text, padding: '6px 16px', borderRadius: 50, fontWeight: 800, fontSize: 13, border: `1px solid ${risk.text}33` }}>
                    {risk.icon} RISQUE {String(aiData.niveau_risque || 'moyen').toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Advanced Expert Sections */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                
                {/* Reliability Gauge Card */}
                <div className="justificatif-box" style={{ background: 'rgba(255,255,255,0.01)', padding: '24px', textAlign: 'center' }}>
                  <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-subtle)', marginBottom: 16, textTransform: 'uppercase' }}>Indice de Confiance</h4>
                  <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto' }}>
                    <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={result.reliability_score > 80 ? '#22c55e' : (result.reliability_score > 50 ? '#eab308' : '#ef4444')} strokeWidth="3" strokeDasharray={`${result.reliability_score}, 100`} />
                    </svg>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 20, fontWeight: 900 }}>{result.reliability_score}%</div>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                    Cohérence mathématique entre les salaires détectés et les points Agirc-Arrco attribués.
                  </p>
                </div>

                {/* Career Projection Card */}
                <div className="justificatif-box" style={{ background: 'rgba(255,255,255,0.01)', padding: '24px' }}>
                  <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-subtle)', marginBottom: 16, textTransform: 'uppercase', textAlign: 'center' }}>Projection de Pension</h4>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--primary-light)' }}>
                      {aiData.projection_estimee || '—'}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.6 }}>ESTIMATION MENSUELLE (BRUT)</div>
                    <div style={{ marginTop: 16, padding: '8px', background: 'rgba(79,70,229,0.05)', borderRadius: '8px', fontSize: 11 }}>
                      Hypothèse : Retraite à taux plein à 64 ans, maintien du dernier salaire connu.
                    </div>
                  </div>
                </div>

              </div>
              
              <div className="justificatif-box" style={{ background: 'rgba(255,255,255,0.02)', marginBottom: 24 }}>
                 <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                   {cleanText(aiData.resume_global || aiData.resume || "Synthèse en cours de finalisation...")}
                 </p>
              </div>

              {/* Technical Control Table (Tableau de Contrôle) */}
              {result.career_data && (
                <div style={{ marginBottom: 32, overflowX: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary-light)', margin: 0 }}>🛡️ Tableau de Contrôle Technique</h4>
                    <span style={{ fontSize: 11, background: 'rgba(79,70,229,0.1)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>AUDIT RÉGLEMENTAIRE</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                        <th style={{ padding: '12px 8px' }}>Année</th>
                        <th style={{ padding: '12px 8px' }}>Régime</th>
                        <th style={{ padding: '12px 8px' }}>Salaire Brut</th>
                        <th style={{ padding: '12px 8px' }}>Trimestres (RIS/Théo)</th>
                        <th style={{ padding: '12px 8px' }}>Points (RIS/Théo)</th>
                        <th style={{ padding: '12px 8px' }}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {JSON.parse(result.career_data).slice(-15).reverse().map((d, idx) => {
                        const statusColors = {
                          'conforme': { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'CONFORME' },
                          'écart': { color: '#eab308', bg: 'rgba(234,179,8,0.1)', label: 'ÉCART' },
                          'anomalie': { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'ANOMALIE' }
                        }
                        const s = statusColors[d.status] || statusColors['conforme']
                        
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)', opacity: d.salary > 0 ? 1 : 0.6 }}>
                            <td style={{ padding: '12px 8px', fontWeight: 700 }}>{d.year}</td>
                            <td style={{ padding: '12px 8px', fontSize: 10, fontWeight: 600 }}>{d.regime}</td>
                            <td style={{ padding: '12px 8px' }}>{d.salary > 0 ? `${d.salary.toLocaleString()} €` : '—'}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <span style={{ fontWeight: 700 }}>{d.ris_quarters}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}> / {d.theo_quarters}</span>
                            </td>
                            <td style={{ padding: '12px 8px' }}>
                              <span style={{ fontWeight: 700 }}>{d.ris_points > 0 ? d.ris_points.toFixed(2) : '—'}</span>
                              {d.theo_points > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}> / {d.theo_points.toFixed(2)}</span>}
                            </td>
                            <td style={{ padding: '12px 8px' }}>
                              <div style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 900, textAlign: 'center', border: `1px solid ${s.color}33`, width: 'fit-content' }}>
                                {s.label}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border)' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                      💡 <strong>Note d'audit :</strong> Ce tableau compare vos droits enregistrés au calcul théorique basé sur le SMIC historique (pour les trimestres) et les valeurs de service Agirc-Arrco. Un écart peut s'expliquer par des périodes d'arrêt, de chômage ou des dépassements de plafond de SS.
                    </p>
                  </div>
                </div>
              )}

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
                        {item.justificatif_suggere ? (
                          <div className="justificatif-box" style={{ borderColor: 'var(--primary-light)', padding: '16px' }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary-light)', textTransform: 'uppercase', marginBottom: 6 }}>📄 Justificatif(s) :</div>
                            <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'pre-wrap' }}>{cleanText(item.justificatif_suggere)}</div>
                          </div>
                        ) : (
                          item.needs_justificatifs && <JustificatifsBlock />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sticky Footer for "Analyze another RIS" (AUD-009) */}
        <div className="sticky-footer shadow-expert">
          <div className="container" style={{ maxWidth: 740, display: 'flex', justifyContent: 'center' }}>
            <button className="btn btn-secondary btn-large" onClick={onReset} style={{ width: '100%', maxWidth: 400 }}>
              ← Analyser un autre document RIS
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
