import React from 'react'

export default function Securite() {
  return (
    <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', flex: 1, maxWidth: '800px' }}>
      <h1 className="text-3xl font-bold mb-6">Sécurité des données</h1>
      
      <div className="card flex flex-col gap-6">
        <section>
          <h2 className="text-xl font-semibold mb-2">1. Chiffrement</h2>
          <p className="text-muted">
            Toutes les communications entre votre navigateur et nos serveurs sont chiffrées de bout en bout (Protocole HTTPS / TLS).<br/>
            Vos relevés de carrière sont également chiffrés au repos sur nos serveurs (AES-256).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">2. Hébergement Sécurisé</h2>
          <p className="text-muted">
            L'infrastructure de stockage et d'authentification est gérée via <strong>Supabase</strong>, qui assure de hauts standards de sécurité. Les données sont hébergées de manière cloisonnée avec des politiques de sécurité strictes pour garantir leur intégrité et leur confidentialité. L'application est propulsée par <strong>Vercel</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">3. Purge Automatique</h2>
          <p className="text-muted">
            Le cœur de notre dispositif de sécurité repose sur la non-conservation. Les documents téléchargés et les analyses générées sont automatiquement et irrémédiablement effacés par nos processus de purge après un délai de <strong>48 heures</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">4. Signalement</h2>
          <p className="text-muted">
            Si vous avez des questions sur la sécurité ou si vous identifiez une faille potentielle, merci de nous contacter urgemment à :<br/>
            <a href="mailto:bertrand.saulnerond@hologramconseils.com">bertrand.saulnerond@hologramconseils.com</a>
          </p>
        </section>
      </div>
    </div>
  )
}
