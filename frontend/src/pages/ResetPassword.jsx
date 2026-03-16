import React, { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../services/api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await authAPI.resetPassword(token, password)
      setSuccess(true)
      setTimeout(() => navigate('/'), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
          <h2>Lien invalide</h2>
          <p>Ce lien de réinitialisation est manquant ou corrompu.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 20 }}>Retour à l'accueil</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="bg-dots" />
      <div className="card" style={{ maxWidth: 400, width: '100%', position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>Nouveau mot de passe</h1>
          <p style={{ color: 'var(--text-muted)' }}>Définissez votre nouveau secret.</p>
        </div>

        {success ? (
          <div className="alert alert-success" style={{ textAlign: 'center' }}>
            ✅ Mot de passe réinitialisé !<br />
            Redirection vers l'accueil...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-form">
            <div className="input-group">
              <label>Nouveau mot de passe *</label>
              <input 
                className="input" 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                minLength={6} 
              />
            </div>
            <div className="input-group">
              <label>Confirmer le mot de passe *</label>
              <input 
                className="input" 
                type="password" 
                placeholder="••••••••" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
              />
            </div>

            {error && <div className="alert alert-error">⚠️ {error}</div>}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Chargement...' : 'Enregistrer'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
