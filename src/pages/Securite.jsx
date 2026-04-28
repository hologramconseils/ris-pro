import React from 'react'
import { LABELS } from '../config/labels'

export default function Securite() {
  return (
    <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', flex: 1, maxWidth: '800px' }}>
      <h1 className="text-3xl font-bold mb-6">{LABELS.DATA_SECURITY}</h1>
      
      <div className="card flex flex-col gap-6">
        <section>
          <h2 className="text-xl font-semibold mb-2">1. Chiffrement et Anonymisation</h2>
          <p className="text-muted">
            Toutes les communications entre votre navigateur et nos serveurs sont chiffrées de bout en bout (Protocole HTTPS / TLS).<br/>
            Conformément aux recommandations de la CNIL, les données d'identification sensibles comme le Numéro de Sécurité Sociale (NIR) sont immédiatement <strong>hachées (SHA-256 avec sel)</strong>. Nous ne stockons jamais votre NIR en clair.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">2. Hébergement Sécurisé</h2>
          <p className="text-muted">
            L'infrastructure de stockage et d'authentification est gérée via <strong>Supabase</strong> (ISO 27001), qui assure de hauts standards de sécurité. Les données sont hébergées de manière cloisonnée. L'application est propulsée par <strong>Vercel</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">3. Purge Automatique</h2>
          <p className="text-muted">
            Le cœur de notre dispositif de sécurité repose sur la non-conservation. Les documents originaux (PDF) sont automatiquement et irrémédiablement effacés de nos serveurs de stockage sous <strong>48 heures</strong>. Seuls les résultats de l'analyse restent accessibles sur votre compte.
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
