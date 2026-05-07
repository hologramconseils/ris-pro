import React from 'react'
import { LABELS } from '../config/labels'

export default function MentionsLegales() {
  return (
    <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', flex: 1, maxWidth: '800px' }}>
      <h1 className="text-3xl font-bold mb-6">{LABELS.LEGAL_MENTIONS}</h1>
      
      <div className="card flex flex-col gap-6">
        <section>
          <h2 className="text-xl font-semibold mb-2">1. Éditeur du site</h2>
          <p className="text-muted">
            Le site {LABELS.APP_NAME} est édité par <strong>{LABELS.BRAND_NAME}</strong>.<br/>
            Forme juridique : Entreprise individuelle<br/>
            Siège social : 7 rue javary, 59800 Lille<br/>
            SIREN : 899864318<br/>
            Numéro de TVA intracommunautaire : FR31899864318
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">2. Directeur de la publication</h2>
          <p className="text-muted">
            Bertrand Saulnerond
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">3. Hébergement</h2>
          <p className="text-muted">
            Ce site est hébergé par : <strong>Vercel Inc.</strong><br/>
            Le stockage et le traitement des données (documents) sont gérés de manière sécurisée via <strong>Supabase</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">4. Contact</h2>
          <p className="text-muted">
            Email : <a href="mailto:bertrand.saulnerond@hologramconseils.com">bertrand.saulnerond@hologramconseils.com</a>
          </p>
        </section>
      </div>
    </div>
  )
}
