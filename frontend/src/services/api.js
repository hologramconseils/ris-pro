import axios from 'axios'
import { coldStartTracker } from './coldStartTracker'

const PROD_DOMAIN = 'ris.hologramconseils.com'
const envUrl = import.meta.env.VITE_API_URL
const RAILWAY_BACKEND = 'https://ris-pro-api.up.railway.app'
const RENDER_BACKEND = 'https://ris-scan-pro-backend.onrender.com'

const isLocalHost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1' || 
   window.location.hostname.includes('192.168.'))

const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname === PROD_DOMAIN || (!isLocalHost && !window.location.hostname.includes('vercel.app')))

// Robust API URL selection with logging
const getApiUrl = () => {
  if (!isProduction) return envUrl || 'http://127.0.0.1:8000'
  
  // In production, prioritize VITE_API_URL if it's not a localhost address OR a Render address (which we know is failing)
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1') && !envUrl.includes('onrender.com')) {
    return envUrl
  }
  
  // Fallback for production if env var is missing or incorrect
  return RAILWAY_BACKEND
}

const API_URL = getApiUrl().replace(/\/api\/v1\/?$/, '')

if (typeof window !== 'undefined') {
  console.log(`%c[RIS-PRO-API] %cMode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`, 'color: #3b82f6; font-weight: bold', 'color: inherit')
  console.log(`%c[RIS-PRO-API] %cBase URL: ${API_URL}`, 'color: #3b82f6; font-weight: bold', 'color: inherit')
  
  if (isProduction && API_URL.includes('onrender.com')) {
    console.warn('[RIS-PRO-API] Attention : Le frontend utilise encore l\'URL Render. Veuillez configurer VITE_API_URL sur Vercel.')
  }
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000 // Increased to 60 seconds for large PDF uploads and OCR
})

// Attach JWT token automatically if available
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// Global Error Handler: handle session expiration and cold-start retries
const MAX_RETRIES = 5;
const INITIAL_DELAY = 2000; // 2 seconds

const isRetryableError = (error) => {
  return (
    !error.response || 
    error.response.status === 503 || 
    error.response.status === 500 || 
    error.code === 'ECONNABORTED' ||
    error.code === 'ERR_NETWORK'
  );
};

const retryRequest = async (error, retryCount = 0) => {
  const { config } = error;
  console.log(`[API] Retrying request ${config.url} (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
  
  if (!config || retryCount >= MAX_RETRIES) {
    const errorMsg = error.response?.data?.detail || error.message || "Le service ne répond pas."
    coldStartTracker.fail(`Erreur de démarrage : ${errorMsg}. Veuillez rafraîchir la page.`);
    return Promise.reject(error);
  }

  const delay = INITIAL_DELAY * Math.pow(2, retryCount) + Math.round(Math.random() * 1000);
  coldStartTracker.trigger();
  await new Promise(resolve => setTimeout(resolve, delay));

  try {
    const response = await api({
      ...config,
      _isRetry: true,
      _retryCount: retryCount + 1
    });
    coldStartTracker.complete();
    return response;
  } catch (err) {
    if (isRetryableError(err)) {
      return retryRequest(err, retryCount + 1);
    }
    coldStartTracker.fail();
    return Promise.reject(err);
  }
};

api.interceptors.response.use(
  response => {
    coldStartTracker.complete();
    return response;
  },
  error => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('access_token');
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
      return Promise.reject(error);
    }
    if (isRetryableError(error) && !error.config?._isRetry) {
      return retryRequest(error);
    }
    return Promise.reject(error);
  }
);

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
  getPreview: (scanId) => api.get(`/scans/preview/${scanId}`),
  retryOCR: (scanId) => api.post(`/scans/${scanId}/retry`),
  listHistory: () => api.get('/scans/history'),
  deleteScan: (scanId) => api.delete(`/scans/${scanId}`),
}

export const billingAPI = {
  createCheckout: (successUrl, cancelUrl) =>
    api.post('/billing/create-checkout-session', null, {
      params: { success_url: successUrl, cancel_url: cancelUrl }
    }),
}

export default api;
