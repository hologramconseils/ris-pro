import { motion } from 'framer-motion'

export default function Security() {
  return (
    <div className="container" style={{ paddingTop: 100, paddingBottom: 100, maxWidth: 800 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 style={{ marginBottom: 40, textAlign: 'center' }}>Sécurité des Données</h1>
        
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>1. Engagement de Confidentialité</h2>
          <p style={{ lineHeight: '1.6', marginBottom: 20 }}>
            Hologram Conseils s'engage à traiter vos documents avec le plus haut niveau de sécurité. Dans le cadre de RIS Pro, la sécurité de vos informations personnelles et professionnelles est notre priorité absolue.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>2. Cycle de vie des documents</h2>
          <div style={{ padding: '30px', background: 'rgba(79,70,229,0.03)', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', color: 'var(--primary-light)', marginBottom: '10px' }}>01. Transmission</h3>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>Les documents sont transmis via un protocole HTTPS chiffré.</p>
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', color: 'var(--primary-light)', marginBottom: '10px' }}>02. Analyse</h3>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>Le moteur d'expertise extrait temporairement les données pour l'audit.</p>
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', color: 'var(--primary-light)', marginBottom: '10px' }}>03. Suppression</h3>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>Dès l'analyse terminée, le fichier original (PDF) est <strong>définitivement supprimé</strong> de nos serveurs.</p>
              </div>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>3. Pas de copie des originaux</h2>
          <p style={{ lineHeight: '1.6' }}>
            Aucune copie du document original n'est conservée. Seul le résultat de l'analyse (rapport expert) est stocké de manière sécurisée dans la base de données PostgreSQL pour vous permettre de le consulter ultérieurement dans votre historique.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>4. Maîtrise de l'historique</h2>
          <p style={{ lineHeight: '1.6', marginBottom: 20 }}>
            Vous êtes maître de vos données. L'utilisateur peut supprimer n'importe quelle analyse de son historique à tout moment. Cette action entraîne la suppression immédiate et irrévocable du rapport expert associé dans notre base de données.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>5. Infrastructure Sécurisée</h2>
          <p style={{ lineHeight: '1.6' }}>
            Nos services sont hébergés sur des infrastructures professionnelles hautement sécurisées (Vercel et Railway), bénéficiant de pare-feux, de systèmes de détection d'intrusion et de mises à jour de sécurité régulières.
          </p>
        </section>
      </motion.div>
    </div>
  )
}
