import { Routes, Route, useSearchParams } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import LandingPage from './pages/LandingPage'
import PaymentSuccess from './pages/PaymentSuccess'
import History from './pages/History'
import ResetPassword from './pages/ResetPassword'
import DetailedResultPage from './pages/DetailedResultPage'
import Legal from './pages/Legal'
import Privacy from './pages/Privacy'
import AdminDashboard from './pages/AdminDashboard'
import Footer from './components/Footer'

function AppContent() {
  const [searchParams] = useSearchParams()
  const isPaymentSuccess = searchParams.get('payment_success') === '1'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={isPaymentSuccess ? <PaymentSuccess /> : <LandingPage />} />
          <Route path="/history" element={<History />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/detailed-result/:id" element={<DetailedResultPage />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/admin" element={<AdminDashboard />} />
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
      <ColdStartProvider>
        <ColdStartLoader />
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ColdStartProvider>
    </ErrorBoundary>
  )
}
