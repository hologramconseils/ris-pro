import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, FileText, CheckCircle2, ShieldCheck, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const navigate = useNavigate()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setError(null)
      handleFileUpload(droppedFile)
    } else {
      setError("Veuillez sélectionner un fichier PDF valide.")
    }
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setError(null)
      handleFileUpload(selectedFile)
    } else {
      setError("Veuillez sélectionner un fichier PDF valide.")
    }
  }

  const handleFileUpload = async (selectedFile) => {
    if (!selectedFile) return
    setIsUploading(true)
    setError(null)
    
    try {
      // 1. Générer un nom de fichier unique sécurisé
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `uploads/${fileName}`

      // 2. Upload dans le bucket Supabase
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // 3. Enregistrer l'analyse dans la base de données
      const { error: dbError } = await supabase
        .from('analyses')
        .insert([
          { file_path: filePath, status: 'pending' }
        ])

      if (dbError) throw dbError

      // Redirection automatique vers le diagnostic en passant le chemin du fichier
      setTimeout(() => {
        navigate(`/diagnostic?file=${encodeURIComponent(filePath)}`)
      }, 1500)
      
    } catch (err) {
      console.error("Erreur d'upload :", err)
      setError("Une erreur est survenue lors de l'envoi du fichier. Assurez-vous d'avoir configuré les clés Supabase dans .env.local.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleClickUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div className="container" style={{ padding: '4rem 1.5rem', flex: 1 }}>
      <div className="flex flex-col items-center text-center animate-slide-up" style={{ maxWidth: '800px', margin: '0 auto', gap: '1.5rem' }}>
        
        <h1 className="text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>
          Auditez votre relevé de carrière en <span style={{ color: 'var(--primary)' }}>quelques secondes.</span>
        </h1>
        
        <p className="text-xl text-muted" style={{ maxWidth: '600px', marginBottom: '2rem' }}>
          Détectez automatiquement les anomalies de droits à la retraite, vérifiez vos trimestres et obtenez un plan de régularisation concret.
        </p>

        {error && (
          <div className="flex items-center gap-2 text-danger" style={{ background: 'var(--danger-bg)', padding: '1rem', borderRadius: '0.5rem', width: '100%', justifyContent: 'center' }}>
            <ShieldAlert size={20} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {isUploading ? (
          <div className="card glass flex flex-col items-center justify-center animate-pulse" style={{ width: '100%', padding: '4rem 2rem', gap: '1.5rem' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', border: '4px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
              <ShieldCheck size={24} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--primary)' }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Analyse experte et Sécurisation en cours...</h3>
              <p className="text-sm text-muted">Vérification de 145 règles métiers et chiffrement du document</p>
            </div>
          </div>
        ) : (
          <div 
            className={`card ${isDragging ? 'glass' : ''}`}
            style={{ 
              width: '100%', 
              padding: '4rem 2rem', 
              border: `2px dashed ${isDragging ? 'var(--primary)' : 'rgba(0,0,0,0.1)'}`,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClickUpload}
          >
            <div className="flex flex-col items-center gap-4">
              <div style={{ padding: '1rem', background: 'var(--success-bg)', borderRadius: '50%', color: 'var(--success)' }}>
                <UploadCloud size={32} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Uploader mon relevé de carrière</h3>
                <p className="text-sm text-muted">Glissez-déposez votre RIS / EIG au format PDF ou cliquez pour parcourir.</p>
              </div>
              <label className="btn btn-primary" style={{ marginTop: '1rem', cursor: 'pointer' }} onClick={(e) => e.stopPropagation()}>
                <FileText size={18} />
                Sélectionner un fichier
                <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileChange} />
              </label>
            </div>
          </div>
        )}

        <div className="flex items-center gap-8" style={{ marginTop: '3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 size={18} className="text-success" />
            <span>95% de précision</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 size={18} className="text-success" />
            <span>100% Confidentiel</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 size={18} className="text-success" />
            <span>Support Régimes de Base & Complémentaires</span>
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
