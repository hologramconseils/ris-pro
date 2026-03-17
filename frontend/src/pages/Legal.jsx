import { motion } from 'framer-motion'

export default function Legal() {
  return (
    <div className="container" style={{ paddingTop: 100, paddingBottom: 100, maxWidth: 800 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 style={{ marginBottom: 40, textAlign: 'center' }}>Mentions Légales & CGV</h1>
        
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>1. Éditeur de la plateforme</h2>
          <p style={{ marginBottom: 10 }}>Conformément à l'article 6 de la loi n° 2004-575 du 21 juin 2004 :</p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li><strong>Dénomination sociale :</strong> [NOM DE VOTRE SOCIÉTÉ - Ex: Hologram Conseils]</li>
            <li><strong>Forme juridique :</strong> [FORME JURIDIQUE - Ex: SAS / SARL]</li>
            <li><strong>Capital social :</strong> [MONTANT DU CAPITAL] €</li>
            <li><strong>Siège social :</strong> [ADRESSE DU SIÈGE]</li>
            <li><strong>SIRET :</strong> [NUMÉRO SIRET]</li>
            <li><strong>Directeur de la publication :</strong> [NOM DU DIRECTEUR]</li>
            <li><strong>Contact :</strong> [EMAIL DE CONTACT]</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>2. Hébergement</h2>
          <p>
            L'hébergement de l'application est assuré par :<br />
            <strong>Backend :</strong> Render.com<br />
            <strong>Frontend :</strong> Vercel Inc., 340 S Lemon Ave #4133 Walnut, CA 91789, USA.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>3. Conditions Générales de Vente (CGV)</h2>
          <p style={{ marginBottom: 15 }}>
            RIS Pro propose un service d'analyse de relevé de carrière.
          </p>
          <h3>Prix et Paiement</h3>
          <p style={{ marginBottom: 15 }}>
            Le prix de l'analyse détaillée est fixé à <strong>19,00 € TTC</strong>. 
            Le paiement est effectué de manière sécurisée via la plateforme Stripe.
          </p>
          <h3>Absence de droit de rétractation</h3>
          <p style={{ marginBottom: 15 }}>
            Conformément à l’article L.221-28 1° du Code de la consommation, le droit de rétractation ne peut être exercé pour les contrats de fourniture de services pleinement exécutés avant la fin du délai de rétractation. En validant votre analyse, vous demandez l'exécution immédiate du service et renoncez expressément à votre droit de rétractation.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>4. Propriété Intellectuelle</h2>
          <p>
            L'intégralité du contenu de ce site (code, design, textes, algorithmes) est la propriété exclusive de [NOM DE VOTRE SOCIÉTÉ]. Toute reproduction ou exploitation sans autorisation préalable est interdite.
          </p>
        </section>
      </motion.div>
    </div>
  )
}
