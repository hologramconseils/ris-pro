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
  const { user: currentUser } = useAuth()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token')
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
  }, [currentUser])

  if (loading) return <div className="container" style={{ textAlign: 'center', padding: '100px 0' }}>Chargement...</div>

  return (
    <motion.div 
      className="container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ padding: '40px 20px' }}
    >
      <header style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: 10 }}>Tableau de Bord Admin</h1>
        <p style={{ color: 'var(--text-subtle)' }}>Suivi de l'activité et des utilisateurs de RIS Pro.</p>
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
            background: 'rgba(255,255,255,0.05)', 
            borderRadius: 16, 
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ padding: 24, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Derniers Utilisateurs</h3>
              <span style={{ fontSize: 13, color: 'var(--text-subtle)' }}>{users.length} utilisateurs au total</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', fontSize: 13, color: 'var(--text-subtle)' }}>
                    <th style={{ padding: '16px 24px' }}>Utilisateur</th>
                    <th style={{ padding: '16px 24px' }}>Statut</th>
                    <th style={{ padding: '16px 24px' }}>Dernière Connexion</th>
                    <th style={{ padding: '16px 24px' }}>Connexions</th>
                    <th style={{ padding: '16px 24px' }}>Inscription</th>
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
                          <span style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.1)', color: '#10B981', fontSize: 11, fontWeight: 600 }}>PAYÉ</span>
                        ) : (
                          <span style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--text-subtle)', fontSize: 11 }}>GRATUIT</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-subtle)' }}>
                        {u.last_login ? new Date(u.last_login).toLocaleString('fr-FR') : 'Jamais'}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                        {u.login_count || 0}
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-subtle)' }}>
                        {new Date(u.created_at).toLocaleDateString('fr-FR')}
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
