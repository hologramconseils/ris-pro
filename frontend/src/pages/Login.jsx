import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LogIn, ShieldAlert, Loader2, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { LABELS } from '../config/labels'

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isResetting, setIsResetting] = useState(window.location.hash.includes('type=recovery'))
  
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })
      if (updateError) throw updateError
      setMessage('Votre mot de passe a été mis à jour. Vous allez être redirigé.')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Erreur lors de la mise à jour.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Veuillez saisir votre adresse email.')
      return
    }
    
    setLoading(true)
    setError('')
    setMessage('')
    
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (resetError) throw resetError
      setMessage('Un lien de réinitialisation a été envoyé sur votre email.')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Erreur lors de l\'envoi du mail.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (signInError) throw signInError
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName
            }
          }
        })
        if (signUpError) throw signUpError
        
        // Si la confirmation d'email est activée sur Supabase, la session sera nulle
        if (data && !data.session) {
          setMessage('Inscription réussie ! Un e-mail de confirmation vous a été envoyé. Veuillez vérifier votre boîte de réception.')
          setLoading(false)
          return
        }
      }

      // Règle absolue 1 : Invalider toute analyse existante au login pour forcer le rechargement brut
      sessionStorage.clear()

      navigate(redirect)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Une erreur est survenue.')
    } finally {
      // Ne pas passer loading à false si on a mis un message persistant
      if (!message) {
        setLoading(false)
      }
    }
  }

  return (
    <div className="container flex items-center justify-center animate-fade-in" style={{ flex: 1, padding: '4rem 1.5rem' }}>
      <div className="card glass p-8 w-full max-w-md">
        <div className="flex flex-col items-center gap-4 mb-8 text-center">
          <div style={{ background: 'var(--primary)', color: 'white', padding: '1rem', borderRadius: '50%' }}>
            {isResetting ? <ShieldAlert size={32} /> : (isLogin ? <LogIn size={32} /> : <UserPlus size={32} />)}
          </div>
          <h1 className="text-2xl font-bold">
            {isResetting ? 'Nouveau mot de passe' : (isLogin ? 'Connexion' : 'Créer un compte')}
          </h1>
          <p className="text-muted text-sm">
            {isResetting 
              ? 'Saisissez votre nouveau mot de passe pour sécuriser votre compte.'
              : (isLogin 
                ? 'Connectez-vous pour accéder à vos analyses illimitées.' 
                : `Créez votre compte pour débloquer la version complète de ${LABELS.APP_NAME}.`)}
          </p>
        </div>

        <form onSubmit={isResetting ? handleUpdatePassword : handleSubmit} className="flex flex-col gap-4">
          {!isResetting && !isLogin && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold">Prénom</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Jean" 
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold">Nom</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Dupont" 
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          {!isResetting && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">Email</label>
              <input 
                type="email" 
                className="input" 
                placeholder="votre@email.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold">Mot de passe</label>
            <input 
              type="password" 
              className="input" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isResetting || !isLogin ? "new-password" : "current-password"}
              required
            />
            {isLogin && (
              <button 
                type="button" 
                className="text-xs text-right mt-1" 
                style={{ color: 'var(--primary)', opacity: 0.8, background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', display: 'block', marginLeft: 'auto' }}
                onClick={handleForgotPassword}
              >
                Mot de passe oublié ?
              </button>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-error text-sm p-3 bg-error-bg rounded-lg">
              <ShieldAlert size={16} />
              {error}
            </div>
          )}

          {message && (
            <div className="flex items-center gap-2 text-success text-sm p-3 bg-success-bg rounded-lg" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
              <Loader2 size={16} className="animate-spin" />
              {message}
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" /> : (isResetting ? 'Mettre à jour le mot de passe' : (isLogin ? 'Se connecter' : 'Créer mon compte'))}
          </button>
          
          {!isResetting && (
            <div className="text-center mt-4">
              <button 
                type="button"
                className="text-sm font-medium"
                style={{ color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit' }}
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? "Pas encore de compte ? Cliquez ici pour en créer un." : "Déjà un compte ? Cliquez ici pour vous connecter."}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
