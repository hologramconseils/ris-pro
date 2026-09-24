import { useEffect } from 'react'

// Pages applicatives dynamiques (diagnostic en cours, bilan, connexion) : jamais de valeur
// SEO propre (contenu variable ou vide selon l'état), et elles partagent le <title>/<meta
// description> statiques de index.html tant qu'aucun <SEO> dédié n'est monté avant leurs
// premiers rendus conditionnels (spinner, erreur). On les exclut explicitement de l'index
// plutôt que de laisser Google indexer une page vide ou dupliquée.
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      document.head.removeChild(meta)
    }
  }, [])
}
