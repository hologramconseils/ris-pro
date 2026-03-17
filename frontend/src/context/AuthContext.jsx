import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const timeoutRef = useRef(null)

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    setUser(null)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  // Auto-logout after 10 minutes of inactivity
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (user) {
      timeoutRef.current = setTimeout(() => {
        logout()
        // Optional: We can dispatch a custom event or redirect, but logout() clears state
        window.location.href = '/' // Force back to landing
      }, 24 * 60 * 60 * 1000) // 24 hours
    }
  }, [user, logout])

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    const handleActivity = () => resetTimeout()

    if (user) {
      resetTimeout()
      events.forEach(e => window.addEventListener(e, handleActivity))
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      events.forEach(e => window.removeEventListener(e, handleActivity))
    }
  }, [user, resetTimeout])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      authAPI.me()
        .then(res => setUser(res.data))
        .catch(() => { localStorage.removeItem('access_token'); setUser(null) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const res = await authAPI.login(email, password)
    localStorage.setItem('access_token', res.data.access_token)
    // Use user data returned from login instead of calling /me
    const userData = res.data.user
    setUser(userData)
    return userData
  }

  const register = async (data) => {
    await authAPI.register(data)
    return await login(data.email, data.password)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
