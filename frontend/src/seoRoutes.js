// Single source of truth for the title/description of every statically
// indexable route. Used both by <SEO> at runtime (react-helmet-async) and by
// scripts/prerender-seo.mjs at build time, so the tags a crawler sees in the
// raw HTML and the tags React sets after hydration never drift apart again.
export const SEO_ROUTES = [
  {
    path: '/',
    title: 'RIS Pro – Audit IA de votre relevé de carrière',
    description: "Déposez votre relevé de carrière : RIS Pro détecte gratuitement les trimestres manquants et anomalies de retraite en quelques minutes.",
  },
  {
    path: '/mentions-legales',
    title: 'Mentions légales | RIS Pro',
    description: 'Mentions légales du site RIS Pro, édité par Hologram Conseils : éditeur, hébergement et informations légales.',
  },
  {
    path: '/cgv',
    title: 'Conditions Générales de Vente | RIS Pro',
    description: "Conditions générales de vente applicables à l'utilisation et à l'achat de bilans sur RIS Pro, par Hologram Conseils.",
  },
  {
    path: '/politique-confidentialite',
    title: 'Politique de confidentialité | RIS Pro',
    description: 'Politique de confidentialité de RIS Pro : données collectées, finalités, durée de conservation et vos droits RGPD.',
  },
  {
    path: '/securite',
    title: 'Sécurité des données | RIS Pro',
    description: 'Comment RIS Pro protège vos données de carrière et de retraite : chiffrement, hébergement et bonnes pratiques de sécurité.',
  },
]

export const SEO_ROUTES_BY_PATH = Object.fromEntries(SEO_ROUTES.map((route) => [route.path, route]))
