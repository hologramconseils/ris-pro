import React, { useEffect, useRef, useState } from 'react'
import { useClerk, useSession } from '@clerk/clerk-react'
import { Clock } from 'lucide-react'
import {
  WARNING_MS,
  remainingMs,
  readLastActivity,
  writeLastActivity,
  clearLocalTraces,
} from '../idleTimeout'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel']

// Déconnecte l'utilisateur après 10 minutes sans activité (souris, clavier, défilement, toucher),
// avec un avertissement une minute avant. Protège les données d'un relevé de carrière laissé
// ouvert sur un ordinateur partagé ou un téléphone non verrouillé.
export default function IdleLogout() {
  const { session, isSignedIn } = useSession()
  const { signOut } = useClerk()
  const [secondsLeft, setSecondsLeft] = useState(null)
  const signingOut = useRef(false)
  const sessionId = session?.id

  useEffect(() => {
    if (!isSignedIn || !sessionId) {
      setSecondsLeft(null)
      return
    }
    signingOut.current = false

    const markActivity = () => writeLastActivity(localStorage, sessionId, Date.now())

    // Retour du paiement Stripe (/bilan?success=true) : le temps passé sur la page de paiement
    // ne doit pas déconnecter l'utilisateur à son retour.
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true' || readLastActivity(localStorage, sessionId) === null) {
      markActivity()
    }

    let lastWrite = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - lastWrite < 5000) return
      lastWrite = now
      markActivity()
    }

    const tick = () => {
      const left = remainingMs(readLastActivity(localStorage, sessionId), Date.now())
      if (left <= 0) {
        if (!signingOut.current) {
          signingOut.current = true
          clearLocalTraces(localStorage, sessionStorage)
          signOut({ redirectUrl: '/' })
        }
        return
      }
      setSecondsLeft(left <= WARNING_MS ? Math.ceil(left / 1000) : null)
    }

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', tick)
    tick()
    const interval = setInterval(tick, 1000)

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', tick)
      clearInterval(interval)
    }
  }, [isSignedIn, sessionId, signOut])

  if (secondsLeft === null) return null

  const stayConnected = () => {
    writeLastActivity(localStorage, sessionId, Date.now())
    setSecondsLeft(null)
  }
  const logoutNow = () => {
    signingOut.current = true
    clearLocalTraces(localStorage, sessionStorage)
    signOut({ redirectUrl: '/' })
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-logout-title"
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div className="card" style={{ maxWidth: '420px', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <Clock size={36} className="text-warning" />
        <h2 id="idle-logout-title" className="text-xl font-bold" style={{ margin: 0 }}>Toujours là ?</h2>
        <p className="text-muted text-sm" style={{ margin: 0 }}>
          Pour protéger vos données, vous allez être déconnecté dans <strong>{secondsLeft} seconde{secondsLeft > 1 ? 's' : ''}</strong> faute d'activité.
        </p>
        <div className="flex flex-col gap-2 w-full">
          <button className="btn btn-primary w-full" onClick={stayConnected} autoFocus>Rester connecté</button>
          <button className="btn btn-ghost w-full" onClick={logoutNow}>Me déconnecter</button>
        </div>
      </div>
    </div>
  )
}
