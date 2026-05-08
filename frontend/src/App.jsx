import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Diagnostic from './pages/Diagnostic'
import Bilan from './pages/Bilan'
import MentionsLegales from './pages/MentionsLegales'
import CGV from './pages/CGV'
import PolitiqueConfidentialite from './pages/PolitiqueConfidentialite'
import Securite from './pages/Securite'

function App() {
  return (
    <Router>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <main style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/diagnostic" element={<Diagnostic />} />
            <Route path="/bilan" element={<Bilan />} />
            <Route path="/mentions-legales" element={<MentionsLegales />} />
            <Route path="/cgv" element={<CGV />} />
            <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
            <Route path="/securite" element={<Securite />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  )
}

export default App
