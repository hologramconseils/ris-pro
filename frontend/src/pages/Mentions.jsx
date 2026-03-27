import { motion } from 'framer-motion'

export default function Mentions() {
  return (
    <div className="container" style={{ paddingTop: 100, paddingBottom: 100, maxWidth: 800 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 style={{ marginBottom: 40, textAlign: 'center' }}>Mentions Légales</h1>
        
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>1. Éditeur de la plateforme</h2>
          <p style={{ marginBottom: 10 }}>Conformément à l'article 6 de la loi n° 2004-575 du 21 juin 2004 :</p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li><strong>Dénomination sociale :</strong> Hologram Conseils</li>
            <li><strong>Forme juridique :</strong> Entreprise individuelle (EI)</li>
            <li><strong>Siège social :</strong> 7 rue javary, entrée D, 59800 Lille</li>
            <li><strong>SIRET :</strong> 89986431800030</li>
            <li><strong>Directeur de la publication :</strong> Bertrand Saulnerond</li>
            <li><strong>Contact :</strong> bertrand.saulnerond@hologramconseils.com</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>2. Hébergement technique</h2>
          <p style={{ lineHeight: '1.6' }}>
            L'infrastructure technique de RIS Pro est répartie comme suit :<br /><br />
            <strong>Interface Utilisateur (Frontend) :</strong><br />
            Hébergé par <strong>Vercel Inc.</strong> (Vercel.com)<br />
            Adresse : 440 N Barranca Ave #4133 Covina, CA 91723, USA.<br /><br />
            
            <strong>Moteur d'analyse et Services (Backend) :</strong><br />
            Hébergé par <strong>Railway</strong> (Railway.app)<br /><br />
            
            <strong>Stockage des données (Base de données) :</strong><br />
            PostgreSQL hébergé sur <strong>Railway</strong>.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>3. Propriété Intellectuelle</h2>
          <p style={{ marginBottom: 15, lineHeight: '1.6' }}>
            L'intégralité du contenu de ce site (logiciels, algorithmes d'analyse, design, textes, logos) est la propriété exclusive de Hologram Conseils. 
            Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite, sauf autorisation écrite préalable de Hologram Conseils.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 20 }}>4. Responsabilité</h2>
          <p style={{ lineHeight: '1.6' }}>
            Hologram Conseils s'efforce de fournir des informations aussi précises que possible. Toutefois, le service RIS Pro est un outil d'aide à la décision basé sur l'analyse automatisée de documents. 
            Les résultats fournis sont donnés à titre indicatif et ne constituent pas un document officiel de la CNAV ou de tout autre organisme de retraite. 
            L'utilisateur est seul responsable de l'utilisation des résultats obtenus et est invité à vérifier ses droits auprès des organismes compétents.
          </p>
        </section>
      </motion.div>
    </div>
  )
}
