import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'ris.hologramconseils.com' 
    ? 'https://ris-scan-pro-backend.onrender.com' 
    : 'http://localhost:8000')

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000 // 15 seconds timeout
})

// Attach JWT token automatically if available
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// Global Error Handler: handle session expiration
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // If unauthorized, clear token and we could redirect but better to let AuthContext handle it if it detects null token
      localStorage.removeItem('access_token')
      if (window.location.pathname !== '/') {
        window.location.href = '/'
      }
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (email, password) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    return api.post('/auth/token', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
  },
  me: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, new_password: newPassword }),
}

export const scanAPI = {
  upload: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/scans/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  getResult: (scanId) => api.get(`/scans/${scanId}`),
  listHistory: () => api.get('/scans/history'),
  deleteScan: (scanId) => api.delete(`/scans/${scanId}`),
}

export const billingAPI = {
  createCheckout: (successUrl, cancelUrl) =>
    api.post('/billing/create-checkout-session', null, {
      params: { success_url: successUrl, cancel_url: cancelUrl }
    }),
}

export default api
