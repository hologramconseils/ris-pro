import React from 'react'
import { LABELS } from '../config/labels'

export default function PolitiqueConfidentialite() {
  return (
    <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', flex: 1, maxWidth: '800px', lineHeight: '1.6' }}>
      <h1 className="text-3xl font-bold mb-6">{LABELS.PRIVACY_POLICY}</h1>
      
      <div className="card flex flex-col gap-6" style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '2rem', border: '1px solid var(--border-color)' }}>
        <p className="text-muted" style={{ fontStyle: 'italic', marginBottom: '1.5rem' }}>
          Dernière mise à jour : 28 juin 2026
        </p>
        
        <p className="text-muted">
          La présente Politique de Confidentialité définit la manière dont <strong>Hologram Conseils</strong> collecte, utilise, protège et conserve les données à caractère personnel dans le cadre de l'utilisation de l'application <strong>{LABELS.APP_NAME}</strong> (ci-après "l'Application"), accessible à l'adresse <code>https://ris.hologramconseils.com</code>.
        </p>

        <p className="text-muted">
          Hologram Conseils s'engage à ce que la collecte et le traitement de vos données soient conformes au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.
        </p>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1rem 0' }} />

        <section>
          <h2 className="text-xl font-semibold mb-2">1. Responsable du Traitement</h2>
          <p className="text-muted">
            Le responsable du traitement des données personnelles est :<br />
            <strong>Hologram Conseils</strong><br />
            Représenté par Bertrand Saulnerond<br />
            Email : <a href="mailto:bertrand.saulnerond@hologramconseils.com" className="text-primary">bertrand.saulnerond@hologramconseils.com</a>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">2. Données Personnelles Collectées</h2>
          <p className="text-muted">
            Dans le cadre de l'utilisation de nos services, nous sommes amenés à collecter et traiter les données suivantes :
          </p>
          <ul className="text-muted" style={{ paddingLeft: '1.5rem', listStyleType: 'disc' }}>
            <li><strong>Données de compte</strong> : Prénom, nom, adresse e-mail, mot de passe chiffré.</li>
            <li><strong>Données professionnelles et de carrière</strong> : Relevé d'Information Individuel (RIS) ou Estimation Indicative Globale (EIG) téléversé au format PDF, historique des salaires, trimestres validés, noms des employeurs et années d'activité.</li>
            <li><strong>Données d'identité hautement sensibles (NIR)</strong> : Numéro de Sécurité Sociale (NIR) figurant sur votre document RIS.</li>
            <li><strong>Données de transaction</strong> : Informations de facturation et statut du paiement gérés de manière sécurisée par notre prestataire Stripe (les coordonnées bancaires ne transitent jamais sur nos serveurs).</li>
            <li><strong>Données de connexion</strong> : Adresse IP, logs de connexion et requêtes système à des fins de sécurité.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">3. Finalités et Bases Légales</h2>
          <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Type de traitement</th>
                  <th style={{ padding: '8px' }}>Finalité</th>
                  <th style={{ padding: '8px' }}>Base légale</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '8px' }}><strong>Gestion du compte</strong></td>
                  <td style={{ padding: '8px' }}>Permettre l'accès à l'espace membre et l'historique.</td>
                  <td style={{ padding: '8px' }}>Exécution du contrat (CGV)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '8px' }}><strong>Audit de carrière</strong></td>
                  <td style={{ padding: '8px' }}>Analyser le relevé de carrière et identifier les anomalies.</td>
                  <td style={{ padding: '8px' }}>Consentement explicite au téléversement</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '8px' }}><strong>Paiement Premium</strong></td>
                  <td style={{ padding: '8px' }}>Traiter les transactions pour l'achat du Bilan.</td>
                  <td style={{ padding: '8px' }}>Exécution du contrat (CGV)</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px' }}><strong>Sécurisation de l'App</strong></td>
                  <td style={{ padding: '8px' }}>Prévenir la fraude et le piratage (Rate Limiting).</td>
                  <td style={{ padding: '8px' }}>Intérêt légitime du responsable</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">4. Mesures Strictes de Sécurité (NIR & Documents)</h2>
          <p className="text-muted">
            Les documents RIS/EIG et le numéro de Sécurité Sociale (NIR) font l'objet de mesures de protection renforcées et spécifiques :
          </p>
          <ul className="text-muted" style={{ paddingLeft: '1.5rem', listStyleType: 'disc' }}>
            <li><strong>Masquage et Hachage du NIR</strong> : Le NIR extrait du document PDF n'est <strong>jamais stocké en clair</strong>. Il est immédiatement haché de manière irréversible sous forme d'empreinte cryptographique unique pour prévenir les doublons, puis masqué sous la forme <code>1 77 05 XX XXX XXX XX</code> (seuls le genre, l'année et le mois de naissance indispensables au calcul de la retraite restent visibles).</li>
            <li><strong>Anonymisation des bilans</strong> : Les noms de famille et les données textuelles brutes sont anonymisés à l'affichage pour l'administration afin d'empêcher toute fuite interne.</li>
            <li><strong>Sécurisation du Stockage (RLS)</strong> : Les fichiers PDF importés sont stockés dans un espace de stockage Supabase entièrement privé. Des règles d'accès RLS (Row Level Security) garantissent que seul le propriétaire connecté à son compte personnel peut lire, télécharger ou supprimer ses propres fichiers.</li>
            <li><strong>Chiffrement & Monitoring</strong> : Les données transitent via HTTPS, sont chiffrées au repos, et un système d'alerte automatique par e-mail informe l'administrateur en cas d'accès anormal.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">5. Destinataires et Sous-traitants</h2>
          <p className="text-muted">
            Vos données personnelles ne sont jamais vendues ou cédées à des tiers. Elles sont uniquement partagées avec nos sous-traitants techniques dans la limite nécessaire au bon fonctionnement de l'Application :
          </p>
          <ul className="text-muted" style={{ paddingLeft: '1.5rem', listStyleType: 'disc' }}>
            <li><strong>Vercel</strong> : Hébergement du site web et de l'API.</li>
            <li><strong>Supabase</strong> : Stockage sécurisé des fichiers PDF et de la base de données.</li>
            <li><strong>Stripe</strong> : Traitement sécurisé des transactions de paiement.</li>
            <li><strong>Resend</strong> : Envoi des e-mails transactionnels (confirmation, réinitialisation de mot de passe, alertes).</li>
            <li><strong>Modèles d'Intelligence Artificielle (Gemini API)</strong> : Traitement temporaire du relevé pour l'analyse des anomalies (les données envoyées ne sont pas utilisées pour entraîner les modèles d'IA).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">6. Durée de Conservation</h2>
          <p className="text-muted">
            Les fichiers PDF importés sont conservés de manière sécurisée tant que votre compte est actif. Vous pouvez les supprimer définitivement à tout moment depuis votre espace membre. Les données de compte sont supprimées après 3 ans d'inactivité, et les données de paiement conservées 10 ans conformément aux obligations comptables.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">7. Vos Droits</h2>
          <p className="text-muted">
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, d'opposition, de limitation et de portabilité de vos données. Pour les exercer, vous pouvez nous contacter par e-mail à : <a href="mailto:bertrand.saulnerond@hologramconseils.com" className="text-primary">bertrand.saulnerond@hologramconseils.com</a>.
          </p>
          <p className="text-muted" style={{ marginTop: '0.5rem' }}>
            Vous pouvez également adresser une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés) sur leur site internet <code>https://www.cnil.fr</code>.
          </p>
        </section>
      </div>
    </div>
  )
}
