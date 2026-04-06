import { Routes, Route, useSearchParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Navbar from './components/Navbar'
import LandingPage from './pages/LandingPage'
import PaymentSuccess from './pages/PaymentSuccess'
import History from './pages/History'
import ResetPassword from './pages/ResetPassword'
import DetailedResultPage from './pages/DetailedResultPage'
import Mentions from './pages/Mentions'
import CGV from './pages/CGV'
import Privacy from './pages/Privacy'
import Security from './pages/Security'
import AdminDashboard from './pages/AdminDashboard'
import Dashboard from './pages/Dashboard'
import PreviewPage from './pages/PreviewPage'
import NotFound from './pages/NotFound'
import Footer from './components/Footer'

function AppContent() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const isPaymentSuccess = searchParams.get('payment_success') === '1'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={
            user ? <Dashboard /> : (isPaymentSuccess ? <PaymentSuccess /> : <LandingPage />)
          } />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/detailed-result/:id" element={<DetailedResultPage />} />
          <Route path="/preview/:id" element={<PreviewPage />} />
          {/* Legacy Routes for compatibility */}
          <Route path="/result/:id" element={<DetailedResultPage />} />
          <Route path="/detailed/:id" element={<DetailedResultPage />} />
          <Route path="/login" element={<LandingPage />} />
          <Route path="/register" element={<LandingPage />} />
          <Route path="/mentions" element={<Mentions />} />
          <Route path="/cgv" element={<CGV />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/security" element={<Security />} />
          <Route path="/legal" element={<Mentions />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <Footer />
    </div>
  )
}

import ErrorBoundary from './components/ErrorBoundary'
import { ColdStartProvider, ColdStartLoader } from './context/ColdStartContext'

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ColdStartProvider>
          <ColdStartLoader />
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ColdStartProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
