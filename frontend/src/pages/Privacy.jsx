import { motion } from 'framer-motion'

export default function Privacy() {
  return (
    <div className="container" style={{ paddingTop: 100, paddingBottom: 100, maxWidth: 800 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 style={{ marginBottom: 40, textAlign: 'center' }}>Politique de Confidentialité (RGPD)</h1>
        
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>1. Collecte des données</h2>
          <p style={{ marginBottom: 15, lineHeight: '1.6' }}>
            RIS Pro accorde une importance capitale à la confidentialité de vos données personnelles. Dans le cadre de notre service, nous collectons :
          </p>
          <ul style={{ lineHeight: '1.8' }}>
            <li>Votre adresse email pour la gestion de votre compte.</li>
            <li>Les données extraites de votre Relevé Individuel de Situation (RIS) pour réaliser l'audit.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>2. Protection et Sécurité des documents</h2>
          <div style={{ padding: '24px', background: 'rgba(79,70,229,0.05)', borderRadius: '16px', border: '1px solid rgba(79,70,229,0.2)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', color: 'var(--primary-light)' }}>Gestion des documents transmis :</h3>
            <ul style={{ lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
              <li><strong>Usage unique :</strong> Les documents transmis sont utilisés exclusivement pour la réalisation de l'analyse.</li>
              <li><strong>Suppression automatique :</strong> Les fichiers originaux (notamment PDF) sont supprimés de nos serveurs immédiatement après la fin du traitement de l'analyse (après extraction du texte).</li>
              <li><strong>Aucune copie conservée :</strong> Aucune copie du document original n'est conservée par le système.</li>
              <li><strong>Historique sécurisé :</strong> Seule la synthèse textuelle du résultat d'analyse (rapport expert) peut être enregistrée dans votre historique utilisateur si vous en faites le choix.</li>
              <li><strong>Accès restreint :</strong> Votre historique est accessible uniquement via votre espace client sécurisé par authentification.</li>
              <li><strong>Contrôle total :</strong> Vous pouvez supprimer à tout moment les analyses enregistrées dans votre historique depuis votre tableau de bord.</li>
            </ul>
          </div>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>3. Hébergement et Infrastructure</h2>
          <p style={{ lineHeight: '1.6' }}>
            Vos données sont traitées sur une infrastructure sécurisée :<br /><br />
            - Interface : Vercel<br />
            - Moteur d'Analyse : Railway<br />
            - Base de données : PostgreSQL sur Railway
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>4. Vos droits (RGPD)</h2>
          <p style={{ marginBottom: 15, lineHeight: '1.6' }}>
            Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Pour exercer ces droits, vous pouvez nous contacter à : <strong>bertrand.saulnerond@hologramconseils.com</strong>.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>5. Cookies</h2>
          <p style={{ lineHeight: '1.6' }}>
            Nous utilisons exclusivement des cookies techniques nécessaires au fonctionnement de la session utilisateur. Aucun cookie de traçage publicitaire ou tiers n'est utilisé sur cette plateforme.
          </p>
        </section>
      </motion.div>
    </div>
  )
}
