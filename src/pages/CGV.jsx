import React from 'react'
import { LABELS } from '../config/labels'

export default function CGV() {
  return (
    <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', flex: 1, maxWidth: '800px' }}>
      <h1 className="text-3xl font-bold mb-6">Conditions Générales de Vente (CGV)</h1>
      
      <div className="card flex flex-col gap-6">
        <section>
          <h2 className="text-xl font-semibold mb-2">1. Objet</h2>
          <p className="text-muted">
            Les présentes CGV régissent la vente du service d'audit de relevé de carrière proposé par {LABELS.BRAND_NAME} sur le site {LABELS.APP_NAME}.
            Le service consiste en la mise à disposition d'un pack de <strong>4 analyses détaillées</strong> utilisables pour des identités distinctes ou identiques.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">2. Prix et Paiement</h2>
          <p className="text-muted">
            Le prix du pack (4 analyses) est fixé à <strong>29€ TTC</strong>. Le paiement s'effectue via la plateforme sécurisée Stripe.<br/>
            {LABELS.BRAND_NAME} se réserve le droit de modifier ses prix à tout moment.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">3. Délivrance du service</h2>
          <p className="text-muted">
            Les crédits d'analyse sont crédités sur le compte de l'utilisateur instantanément après la validation du paiement par Stripe. Chaque analyse d'une nouvelle identité décompte un crédit.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">4. Droit de rétractation</h2>
          <p className="text-muted">
            Conformément à l'Article L221-28 du Code de la consommation, s'agissant d'un contenu numérique fourni sur un support immatériel dont l'exécution a commencé avec l'accord préalable exprès du consommateur, le client renonce expressément à son droit de rétractation dès le premier crédit utilisé.
          </p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">5. Litiges</h2>
          <p className="text-muted">
            Les présentes conditions générales sont soumises à la loi française. En cas de litige, une solution amiable sera recherchée avant toute action judiciaire.
          </p>
        </section>
      </div>
    </div>
  )
}
