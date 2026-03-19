import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function AdminDashboard() {
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState({ total_users: 0, paid_users: 0, total_scans: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isVerified, setIsVerified] = useState(() => sessionStorage.getItem('ris_admin_auth_v1') === 'true')
  const [accessCode, setAccessCode] = useState('')
  const [accessError, setAccessError] = useState('')
  const { user: currentUser } = useAuth()

  const ADMIN_CODE = import.meta.env.VITE_ADMIN_CODE || '2024'

  useEffect(() => {
    if (!isVerified) return

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const headers = { Authorization: `Bearer ${token}` }
        
        const [usersRes, statsRes] = await Promise.all([
          axios.get(`${API_URL}/admin/users`, { headers }),
          axios.get(`${API_URL}/admin/stats`, { headers })
        ])
        
        setUsers(usersRes.data)
        setStats(statsRes.data)
      } catch (err) {
        console.error(err)
        setError("Erreur lors de la récupération des données. Vérifiez vos droits admin.")
      } finally {
        setLoading(false)
      }
    }

    if (currentUser?.is_admin) {
      fetchData()
    } else {
      setError("Accès non autorisé.")
      setLoading(false)
    }
  }, [currentUser, isVerified])

  const handleVerify = (e) => {
    e.preventDefault()
    if (accessCode === ADMIN_CODE) {
      setIsVerified(true)
      sessionStorage.setItem('admin_verified', 'true')
      setAccessError('')
    } else {
      setAccessError("Code incorrect.")
    }
  }

  if (!isVerified) {
    return (
      <div className="container" style={{ 
        height: '80vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ 
            background: 'var(--card-bg)', 
            padding: 40, 
            borderRadius: 24, 
            border: '1px solid var(--border-color)',
            maxWidth: 400,
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 20 }}>🔐</div>
          <h2 style={{ marginBottom: 10 }}>Accès Sécurisé</h2>
          <p style={{ color: 'var(--text-subtle)', marginBottom: 30, fontSize: 14 }}>
            Veuillez entrer le code secret administrateur pour accéder à la base de données.
          </p>
          
          <form onSubmit={handleVerify}>
            <input 
              type="password"
              placeholder="Code Secret"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              autoFocus
              style={{ 
                width: '100%', 
                padding: '12px 16px', 
                borderRadius: 12, 
                border: '1px solid var(--border-color)',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontSize: 18,
                textAlign: 'center',
                letterSpacing: 4,
                marginBottom: 20
              }}
            />
            {accessError && <div style={{ color: '#EF4444', marginBottom: 20, fontSize: 13 }}>{accessError}</div>}
            
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Déverrouiller
            </button>
          </form>
        </motion.div>
      </div>
    )
  }

  if (loading) return <div className="container" style={{ textAlign: 'center', padding: '100px 0' }}>Chargement des données confidentielles...</div>

  return (
    <motion.div 
      className="container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ padding: '40px 20px' }}
    >
      <header style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: 10 }}>Contrôle Admin</h1>
          <p style={{ color: 'var(--text-subtle)' }}>Gestion sécurisée des utilisateurs et statistiques.</p>
        </div>
        <button 
          onClick={() => { sessionStorage.removeItem('ris_admin_auth_v1'); setIsVerified(false); }}
          style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: 'var(--text-subtle)', border: 'none', cursor: 'pointer', fontSize: 12 }}
        >
          Déconnexion Admin
        </button>
      </header>

      {error ? (
        <div className="alert alert-error">{error}</div>
      ) : (
        <>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: 24, 
            marginBottom: 40 
          }}>
            <StatCard label="Total Utilisateurs" value={stats.total_users} icon="👥" color="#4F46E5" />
            <StatCard label="Clients Payants" value={stats.paid_users} icon="⭐" color="#F59E0B" />
            <StatCard label="Scans Effectués" value={stats.total_scans} icon="📄" color="#10B981" />
          </div>

          <div style={{ 
            background: 'var(--card-bg)', 
            borderRadius: 16, 
            overflow: 'hidden',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ padding: 24, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Base de données Utilisateurs</h3>
              <span style={{ fontSize: 13, color: 'var(--text-subtle)' }}>{users.length} comptes actifs</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', fontSize: 13, color: 'var(--text-subtle)' }}>
                    <th style={{ padding: '16px 24px' }}>Client</th>
                    <th style={{ padding: '16px 24px' }}>Niveau d'accès</th>
                    <th style={{ padding: '16px 24px' }}>Date d'inscription</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right' }}>ID</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 14 }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 600 }}>{u.first_name} {u.last_name || ''}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{u.email}</div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        {u.has_paid_access ? (
                          <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', color: '#10B981', fontSize: 11, fontWeight: 700 }}>PREMIUM</span>
                        ) : (
                          <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'var(--text-subtle)', fontSize: 11, fontWeight: 500 }}>FREE</span>
                        )}
                        {u.is_admin && <span style={{ marginLeft: 8, color: '#4F46E5', fontSize: 10, fontWeight: 800 }}>ADMIN</span>}
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-subtle)' }}>
                        {new Date(u.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
                        #{u.id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{ 
      background: 'rgba(255,255,255,0.05)', 
      padding: 24, 
      borderRadius: 16, 
      border: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      alignItems: 'center',
      gap: 20
    }}>
      <div style={{ 
        width: 50, 
        height: 50, 
        borderRadius: 12, 
        background: `${color}20`, 
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-subtle)', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  )
}
