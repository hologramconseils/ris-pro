import { Routes, Route, useSearchParams } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import LandingPage from './pages/LandingPage'
import PaymentSuccess from './pages/PaymentSuccess'
import History from './pages/History'
import ResetPassword from './pages/ResetPassword'
import DetailedResultPage from './pages/DetailedResultPage'

function AppContent() {
  const [searchParams] = useSearchParams()
  const isPaymentSuccess = searchParams.get('payment_success') === '1'

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={isPaymentSuccess ? <PaymentSuccess /> : <LandingPage />} />
        <Route path="/history" element={<History />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/detailed-result/:id" element={<DetailedResultPage />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
