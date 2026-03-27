import { motion } from 'framer-motion'

export default function CGV() {
  return (
    <div className="container" style={{ paddingTop: 100, paddingBottom: 100, maxWidth: 800 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 style={{ marginBottom: 40, textAlign: 'center' }}>Conditions Générales de Vente</h1>
        
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>1. Objet du Service</h2>
          <p style={{ lineHeight: '1.6' }}>
            RIS Pro est un service d'audit de Relevé Individuel de Situation (RIS) proposé par <strong>Hologram Conseils</strong>. 
            Il permet d'identifier les anomalies dans les données de carrière de l'assuré et de suggérer les justificatifs nécessaires à la régularisation des droits.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>2. Public Cible</h2>
          <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>Utilisateurs Particuliers :</h3>
            <p style={{ marginBottom: 15, fontSize: '0.95rem' }}>
              Personnes physiques accédant au service pour analyser leur propre relevé de carrière.
            </p>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>Utilisateurs Professionnels :</h3>
            <p style={{ fontSize: '0.95rem' }}>
              Services RH, cabinets de conseil, experts-comptables, organismes spécialisés utilisant la plateforme pour le compte de leurs clients ou employés.
            </p>
          </div>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>3. Prestations et Tarification</h2>
          <h3 style={{ marginBottom: 10 }}>3.1 Analyse Standard (Gratuite)</h3>
          <p style={{ marginBottom: 15, lineHeight: '1.6' }}>
            L'analyse standard permet de visualiser un aperçu des anomalies identifiées (généralement sur deux années) ainsi que le nombre de trimestres et de points correspondants.
          </p>
          <h3 style={{ marginBottom: 10 }}>3.2 Analyse Détaillée (Payante)</h3>
          <p style={{ marginBottom: 15, lineHeight: '1.6' }}>
            Le rapport complet fournit la liste exhaustive de toutes les anomalies, les régimes concernés, le détail des trimestres/points manquants et les pièces justificatives précises à fournir pour chaque période. 
          </p>
          <h3 style={{ marginBottom: 10 }}>3.3 Tarifs</h3>
          <p style={{ lineHeight: '1.6' }}>
            <strong>Pour les particuliers :</strong> Le prix du rapport complet est de <strong>19,00 € TTC</strong> par dossier.<br />
            <strong>Pour les professionnels :</strong> Une tarification spécifique s'applique. Les professionnels sont invités à contacter Hologram Conseils pour obtenir un devis personnalisé ou une licence d'utilisation.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>4. Paiement et Droit de rétractation</h2>
          <p style={{ marginBottom: 15, lineHeight: '1.6' }}>
            Le paiement s'effectue par carte bancaire via la plateforme sécurisée <strong>Stripe</strong>.
          </p>
          <p style={{ lineHeight: '1.6' }}>
            <strong>Droit de rétractation :</strong> Conformément à l’article L.221-28 du Code de la consommation, le droit de rétractation ne peut être exercé pour les services de fourniture de contenus numériques non fournis sur un support matériel dont l'exécution a commencé après accord préalable exprès du consommateur et renoncement exprès à son droit de rétractation. 
            En validant l'achat d'un rapport, l'utilisateur accepte l'exécution immédiate du service et renonce à son droit de rétractation.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>5. Limitation de Responsabilité</h2>
          <p style={{ lineHeight: '1.6' }}>
            Les rapports générés par RIS Pro sont basés sur les données extraites du document fourni par l'utilisateur. 
            En cas de document de mauvaise qualité, flou ou incomplet, le système pourrait ne pas détecter toutes les anomalies. 
            Hologram Conseils ne peut être tenu responsable d'une omission de l'organisme de retraite ou d'une erreur d'interprétation de l'utilisateur.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>6. Règles d'utilisation Professionnelle</h2>
          <p style={{ lineHeight: '1.6' }}>
            Les professionnels s'engagent à respecter les règles de confidentialité relatives aux données de leurs clients et à ne pas utiliser le tarif "Particuliers" pour un usage commercial intensif.
          </p>
        </section>
      </motion.div>
    </div>
  )
}
