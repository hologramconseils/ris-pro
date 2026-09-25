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
  {
    path: '/guides',
    title: 'Guides retraite 2026 : trimestres manquants, cumul emploi-retraite, départ anticipé | RIS Pro',
    description: "Guides pratiques et à jour de la réglementation 2026 : trimestres manquants, cumul emploi-retraite, départ anticipé, retraite progressive, réversion, polypensionnés, expatriation.",
  },
  {
    path: '/guides/trimestres-manquants-releve-de-carriere',
    title: "Trimestres manquants sur le relevé de carrière : comment les détecter et les corriger | RIS Pro",
    description: "Pourquoi un relevé de carrière contient souvent des trimestres manquants ou des salaires erronés, comment les repérer vous-même, et les démarches pour les faire corriger avant qu'il ne soit trop tard.",
  },
  {
    path: '/guides/cumul-emploi-retraite',
    title: 'Cumul emploi-retraite 2026 : règles, plafonds et nouveaux droits à pension | RIS Pro',
    description: "Cumul intégral, cumul plafonné, seconde pension : le fonctionnement actuel du cumul emploi-retraite et la réforme qui entrera en vigueur au 1er janvier 2027 pour les salariés, indépendants et fonctionnaires.",
  },
  {
    path: '/guides/depart-anticipe-retraite-progressive',
    title: 'Départ anticipé et retraite progressive : les dispositifs pour partir plus tôt | RIS Pro',
    description: "Carrière longue, travailleur handicapé, incapacité permanente, retraite progressive dès 60 ans : les conditions précises de chaque dispositif permettant de partir avant l'âge légal ou de réduire son activité en douceur.",
  },
  {
    path: '/guides/pension-reversion-polypensionnes-expatriation',
    title: 'Pension de réversion, polypensionnés, expatriation : les règles à connaître | RIS Pro',
    description: "Trois situations qui compliquent le calcul d'une retraite : le décès d'un conjoint, une carrière partagée entre plusieurs régimes, ou des années travaillées à l'étranger. Ce que dit précisément la réglementation 2026.",
  },
]

export const SEO_ROUTES_BY_PATH = Object.fromEntries(SEO_ROUTES.map((route) => [route.path, route]))
