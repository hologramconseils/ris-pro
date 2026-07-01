import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, FileText, CheckCircle2, ShieldCheck, ShieldAlert, CreditCard } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../AuthContext'
import { LABELS } from '../config/labels'

export default function Home() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const totalCredits = profile?.analysis_credits !== undefined && profile?.analysis_credits !== null ? profile.analysis_credits : 0
  const remainingCredits = Math.max(0, totalCredits - (profile?.analysis_count || 0))
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  // Réinitialisation stricte des sessions de données de carrière
  React.useEffect(() => {
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('ris_pro_analysis_')) {
        sessionStorage.removeItem(key)
      }
    })
  }, [])

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0 && files[0].type === 'application/pdf') {
      setError(null)
      handleFileUpload(files[0])
    } else {
      setError(LABELS.ERROR_INVALID_PDF)
    }
  }

  const handleClickUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const files = e.target.files
    if (files.length > 0) {
      if (files[0].type === 'application/pdf') {
        setError(null)
        handleFileUpload(files[0])
      } else {
        setError(LABELS.ERROR_INVALID_PDF)
      }
    }
  }

  const handleFileUpload = async (selectedFile) => {
    if (!selectedFile) return
    setIsUploading(true)
    setError(null)
    
    try {
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `uploads/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { error: dbError } = await supabase
        .from('analyses')
        .insert([
          { 
            file_path: filePath, 
            status: 'pending',
            user_id: user?.id 
          }
        ])

      if (dbError) throw dbError

      setTimeout(() => {
        navigate(`/diagnostic?file=${encodeURIComponent(filePath)}`)
      }, 1500)
      
    } catch (err) {
      console.error("Erreur d'upload :", err)
      setError(LABELS.ERROR_UPLOAD)
    } finally {
      setIsUploading(false)
    }
  }

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`)
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`)
  }

  const handleBuyCredits = () => {
    // Logic to navigate to payment/subscription
    navigate('/subscription')
  }

  return (
    <div className="container" style={{ padding: '4rem 1.5rem', flex: 1 }}>
      <div className="flex flex-col items-center text-center animate-slide-up" style={{ maxWidth: '800px', margin: '0 auto', gap: '1.5rem' }}>
        
        <h1 className="text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>
          Reprenez le contrôle de votre <span style={{ color: 'var(--primary)' }}>retraite.</span>
        </h1>
        
        <p className="text-xl text-muted" style={{ maxWidth: '600px', marginBottom: '2rem' }}>
          {LABELS.TAGLINE}
          <span style={{ display: 'none' }}>v2.2-20260507 (Restored UI)</span>
        </p>

        {error && (
          <div className="flex items-center gap-2 text-danger" style={{ background: 'var(--danger-bg)', padding: '1rem', borderRadius: '0.5rem', width: '100%', justifyContent: 'center' }}>
            <ShieldAlert size={20} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {!user ? (
          <div className="card glass flex flex-col items-center justify-center text-center" style={{ width: '100%', padding: '4rem 2rem', gap: '1.5rem', borderRadius: '24px' }}>
            <div style={{ padding: '1rem', background: 'var(--primary-bg)', borderRadius: '50%', color: 'var(--primary)' }}>
              <ShieldCheck size={48} />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Connectez-vous pour commencer l'analyse</h3>
              <p className="text-muted max-w-md mx-auto">
                Afin de garantir la sécurité et la confidentialité de vos données, une identification est requise avant tout traitement de votre relevé de carrière.
              </p>
            </div>
            <button 
              className="btn btn-primary btn-cta-premium mt-2" 
              onClick={() => navigate('/login')}
              style={{ padding: '1rem 2.5rem', fontSize: '1rem' }}
            >
              S'identifier ou Créer un compte
            </button>
          </div>
        ) : isUploading ? (
          <div className="card glass flex flex-col items-center justify-center animate-pulse" style={{ width: '100%', padding: '4rem 2rem', gap: '1.5rem' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', border: '4px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
              <ShieldCheck size={24} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--primary)' }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{LABELS.ANALYZING}</h3>
              <p className="text-sm text-muted">Vérification de 145 règles métiers et chiffrement du document</p>
            </div>
          </div>
        ) : (
          <div 
            className={`upload-dropzone card ${isDragging ? 'glass dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClickUpload}
            onMouseMove={handleMouseMove}
          >
            <div className="flex flex-col items-center gap-4">
              <div style={{ padding: '1rem', background: 'var(--success-bg)', borderRadius: '50%', color: 'var(--success)' }}>
                <UploadCloud size={32} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Uploader mon relevé de carrière</h3>
                <p className="text-sm text-muted">
                  <span className="hidden md:inline">Glissez-déposez votre RIS / EIG au format PDF ou </span>
                  <span>cliquez pour parcourir et analyser votre relevé.</span>
                </p>
              </div>
              <label className="btn btn-primary" style={{ cursor: 'pointer' }} onClick={(e) => e.stopPropagation()}>
                <FileText size={18} />
                {LABELS.CTA_SELECT_FILE}
                <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileChange} />
              </label>
            </div>
          </div>
        )}

        <div className="reassurance-container">
          <div className="reassurance-items">
            <div className="reassurance-item">
              <CheckCircle2 size={18} className="text-success" />
              <span>95% de précision</span>
            </div>
            <div className="reassurance-item">
              <CheckCircle2 size={18} className="text-success" />
              <span>100% Confidentiel</span>
            </div>
            <div className="reassurance-item">
              <CheckCircle2 size={18} className="text-success" />
              <span>Support Régimes de Base & Complémentaires</span>
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
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

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
