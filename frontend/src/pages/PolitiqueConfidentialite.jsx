import React from 'react'
import { LABELS } from '../config/labels'

export default function PolitiqueConfidentialite() {
  return (
    <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', flex: 1, maxWidth: '800px' }}>
      <h1 className="text-3xl font-bold mb-6">{LABELS.PRIVACY_POLICY}</h1>
      
      <div className="card flex flex-col gap-6">
        <section>
          <h2 className="text-xl font-semibold mb-2">1. Données collectées</h2>
          <p className="text-muted">
            Dans le cadre de l'utilisation de {LABELS.APP_NAME}, nous traitons le document PDF uploadé (Relevé de carrière / RIS / EIG) strictement nécessaire à l'analyse. Des informations de transaction sont traitées de manière sécurisée par Stripe en cas d'achat.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">2. Finalité du traitement</h2>
          <p className="text-muted">
            Le fichier est traité par notre algorithme uniquement dans le but de réaliser l'audit de vos droits à la retraite. Aucune donnée personnelle issue de ce document n'est revendue ou utilisée à des fins de profilage commercial.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">3. Durée de conservation</h2>
          <p className="text-muted">
            Conformément à nos engagements stricts, le fichier original et les données extraites sont <strong>définitivement supprimés de nos serveurs sous 48 heures</strong> après leur soumission. Seul le résultat synthétique de l'analyse est conservé pour la consultation.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">4. Vos droits (RGPD)</h2>
          <p className="text-muted">
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, et d'effacement de vos données. Pour l'exercer, contactez notre responsable RGPD à :<br/>
            <a href="mailto:bertrand.saulnerond@hologramconseils.com">bertrand.saulnerond@hologramconseils.com</a>
          </p>
        </section>
      </div>
    </div>
  )
}
