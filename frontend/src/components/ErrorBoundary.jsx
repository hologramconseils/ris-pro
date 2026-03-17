import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error Boundary caught an error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          textAlign: 'center',
          minHeight: '80vh'
        }}>
          <div className="bg-dots" />
          <div className="container" style={{ maxWidth: 500 }}>
            <div className="card shadow-expert" style={{ padding: '40px' }}>
              <span style={{ fontSize: 64, marginBottom: 24, display: 'block' }}>⚠️</span>
              <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 16, letterSpacing: -0.5 }}>
                Une erreur est survenue
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
                L'affichage de cette page a rencontré un problème technique inattendu.
              </p>
              <button 
                className="btn btn-primary" 
                onClick={() => window.location.href = '/'}
              >
                Retour à l'accueil
              </button>
              {process.env.NODE_ENV === 'development' && (
                <pre style={{ 
                  marginTop: 24, 
                  padding: 12, 
                  background: 'rgba(0,0,0,0.2)', 
                  borderRadius: 8,
                  fontSize: 12,
                  textAlign: 'left',
                  overflow: 'auto',
                  maxHeight: 200
                }}>
                  {this.state.error?.toString()}
                </pre>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
