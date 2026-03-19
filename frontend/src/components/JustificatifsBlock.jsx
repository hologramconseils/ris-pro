export default function JustificatifsBlock() {
  return (
    <div className="justificatif-box" style={{ 
      borderColor: 'var(--primary-light)', 
      padding: '20px', 
      borderLeft: '5px solid var(--primary-light)',
      background: 'rgba(79,70,229,0.03)',
      marginTop: '16px'
    }}>
      <div style={{ 
        fontSize: 13, 
        fontWeight: 900, 
        color: 'var(--primary-light)', 
        textTransform: 'uppercase', 
        marginBottom: 10, 
        letterSpacing: '0.5px' 
      }}>
        📄 Justificatifs
      </div>
      <div style={{ 
        fontSize: 15, 
        fontWeight: 600, 
        lineHeight: 1.6,
        color: 'var(--text)',
        whiteSpace: 'pre-wrap'
      }}>
        Veuillez fournir une attestation sur l’honneur d’activité ou de non-activité, ainsi que les justificatifs cohérents avec le contenu de cette attestation lorsque l’analyse détecte des éléments manquants dans votre carrière.
      </div>
    </div>
  )
}
