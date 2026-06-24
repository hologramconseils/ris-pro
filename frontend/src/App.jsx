import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Header from './components/Header'
import Footer from './components/Footer'
import { AuthProvider } from './AuthContext'

// Lazy loading of page components to reduce initial bundle size
const Home = lazy(() => import('./pages/Home'))
const Diagnostic = lazy(() => import('./pages/Diagnostic'))
const Bilan = lazy(() => import('./pages/Bilan'))
const Login = lazy(() => import('./pages/Login'))
const MentionsLegales = lazy(() => import('./pages/MentionsLegales'))
const CGV = lazy(() => import('./pages/CGV'))
const PolitiqueConfidentialite = lazy(() => import('./pages/PolitiqueConfidentialite'))
const Securite = lazy(() => import('./pages/Securite'))

function PageLoader() {
  return (
    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '50vh', flexDirection: 'column', gap: '1rem' }}>
      <Loader2 className="animate-spin text-primary" size={36} />
      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Chargement...</span>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Header />
          <main style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/diagnostic" element={<Diagnostic />} />
                <Route path="/bilan" element={<Bilan />} />
                <Route path="/login" element={<Login />} />
                <Route path="/mentions-legales" element={<MentionsLegales />} />
                <Route path="/cgv" element={<CGV />} />
                <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
                <Route path="/securite" element={<Securite />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
