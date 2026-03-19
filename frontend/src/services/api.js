import axios from 'axios'
import { coldStartTracker } from './coldStartTracker'

const API_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'ris.hologramconseils.com' 
    ? 'https://ris-scan-pro-backend.onrender.com' 
    : 'http://127.0.0.1:8000')

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000 // Increased to 30 seconds to handle cold-starts
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

const retryRequest = async (error, retryCount = 0) => {
  const { config } = error;
  
  console.log(`[API] Retrying request ${config.url} (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
  
  if (!config || retryCount >= MAX_RETRIES) {
    console.error(`[API] Max retries reached or missing config for ${config?.url}`);
    coldStartTracker.fail("Le service ne peut pas démarrer. Veuillez réessayer plus tard ou contacter le support.");
    return Promise.reject(error);
  }

  // Calculate exponential backoff delay with jitter
  const delay = INITIAL_DELAY * Math.pow(2, retryCount) + Math.round(Math.random() * 1000);
  console.log(`[API] Waiting ${delay}ms before next attempt...`);
  
  coldStartTracker.trigger();

  await new Promise(resolve => setTimeout(resolve, delay));

  try {
    const response = await api({
      ...config,
      _isRetry: true,
      _retryCount: retryCount + 1
    });
    
    console.log(`[API] Request ${config.url} succeeded after ${retryCount + 1} retries.`);
    coldStartTracker.complete();
    return response;
  } catch (err) {
    // If it's a retry and it also fails with a retryable error, recurse
    if (isRetryableError(err)) {
      return retryRequest(err, retryCount + 1);
    }
    
    coldStartTracker.fail();
    return Promise.reject(err);
  }
};

const isRetryableError = (error) => {
  // Render cold start can manifest as 500 (Internal Server Error) during initialization,
  // 503 (Service Unavailable), or a network timeout.
  return (
    !error.response || 
    error.response.status === 503 || 
    error.response.status === 500 || 
    error.code === 'ECONNABORTED' ||
    error.code === 'ERR_NETWORK'
  );
};

api.interceptors.response.use(
  response => {
    // If we were in cold start mode, ensure we clear it on any successful request
    if (!response.config._isRetry) {
       // We don't necessarily call complete() here to avoid flickering
    }
    return response;
  },
  error => {
    // Handle 401 specifically first
    if (error.response && error.response.status === 401) {
      console.warn("Auth Error (401): Session expired or invalid.");
      localStorage.removeItem('access_token');
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
      return Promise.reject(error);
    }

    // Handle Cold Start / Retryable failures
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
