import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Header from './components/Header'
import Footer from './components/Footer'
import IdleLogout from './components/IdleLogout'
import { AuthProvider } from './AuthContext'
import { ThemeProvider } from './ThemeContext'

// Lazy loading of page components to reduce initial bundle size
const Home = lazy(() => import('./pages/Home'))
const Diagnostic = lazy(() => import('./pages/Diagnostic'))
const Bilan = lazy(() => import('./pages/Bilan'))
const Login = lazy(() => import('./pages/Login'))
const ChoosePassword = lazy(() => import('./pages/ChoosePassword'))
const MagicLogin = lazy(() => import('./pages/MagicLogin'))
const MentionsLegales = lazy(() => import('./pages/MentionsLegales'))
const CGV = lazy(() => import('./pages/CGV'))
const PolitiqueConfidentialite = lazy(() => import('./pages/PolitiqueConfidentialite'))
const Securite = lazy(() => import('./pages/Securite'))
const Guides = lazy(() => import('./pages/Guides'))
const GuideTrimestresManquants = lazy(() => import('./pages/guides/TrimestresManquants'))
const GuideCumulEmploiRetraite = lazy(() => import('./pages/guides/CumulEmploiRetraite'))
const GuideDepartAnticipeRetraiteProgressive = lazy(() => import('./pages/guides/DepartAnticipeRetraiteProgressive'))
const GuidePensionReversionPolypensionnesExpatriation = lazy(() => import('./pages/guides/PensionReversionPolypensionnesExpatriation'))

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
    <ThemeProvider>
        <AuthProvider>
          <Router>
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
              <Header />
              <IdleLogout />
              <main style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/diagnostic" element={<Diagnostic />} />
                    <Route path="/bilan" element={<Bilan />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/activation" element={<ChoosePassword kind="activation" />} />
                    <Route path="/reinitialisation" element={<ChoosePassword kind="reset" />} />
                    <Route path="/connexion-lien" element={<MagicLogin />} />
                    <Route path="/mentions-legales" element={<MentionsLegales />} />
                    <Route path="/cgv" element={<CGV />} />
                    <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
                    <Route path="/securite" element={<Securite />} />
                    <Route path="/guides" element={<Guides />} />
                    <Route path="/guides/trimestres-manquants-releve-de-carriere" element={<GuideTrimestresManquants />} />
                    <Route path="/guides/cumul-emploi-retraite" element={<GuideCumulEmploiRetraite />} />
                    <Route path="/guides/depart-anticipe-retraite-progressive" element={<GuideDepartAnticipeRetraiteProgressive />} />
                    <Route path="/guides/pension-reversion-polypensionnes-expatriation" element={<GuidePensionReversionPolypensionnesExpatriation />} />
                  </Routes>
                </Suspense>
              </main>
              <Footer />
            </div>
          </Router>
        </AuthProvider>
    </ThemeProvider>
  )
}

export default App
