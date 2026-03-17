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
          <p style={{ marginBottom: 15 }}>
            RIS Pro accorde une importance capitale à la confidentialité de vos données personnelles. Dans le cadre de notre service, nous collectons :
          </p>
          <ul>
            <li>Votre adresse email (pour la gestion de votre compte).</li>
            <li>Les données contenues dans votre Relevé Individuel de Situation (RIS) que vous téléchargez sur la plateforme.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>2. Finalité du traitement</h2>
          <p style={{ marginBottom: 15 }}>
            Vos données sont traitées exclusivement pour :
          </p>
          <ul>
            <li>Réaliser l'audit de votre carrière et identifier les anomalies.</li>
            <li>Vous permettre d'accéder à l'historique de vos analyses.</li>
            <li>Assurer le support technique si nécessaire.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>3. Conservation des données</h2>
          <p style={{ marginBottom: 15 }}>
            Les documents PDF téléchargés sont stockés de manière sécurisée et ne sont accessibles que par vous-même. Vous pouvez supprimer vos analyses à tout moment depuis votre historique, ce qui entraîne la suppression immédiate et définitive des données associées.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>4. Vos droits (RGPD)</h2>
          <p style={{ marginBottom: 15 }}>
            Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Pour exercer ces droits, vous pouvez nous contacter à : <strong>bertrand.saulnerond@hologramconseils.com</strong>.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>5. Cookies</h2>
          <p>
            Nous utilisons uniquement des cookies techniques nécessaires au fonctionnement de la session utilisateur. Aucun cookie de traçage publicitaire n'est utilisé sur cette plateforme.
          </p>
        </section>
      </motion.div>
    </div>
  )
}
