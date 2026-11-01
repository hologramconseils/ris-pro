# RIS Pro - Moteur d'Analyse Retraite

## Architecture
- **Frontend** : React + Vite (`frontend/src`)
- **API** : fonctions Node.js (`frontend/api`), servies sur `/api/<nom>` par `server/index.mjs` sur le serveur Hetzner (Helsinki) ; les modules partagés vont dans `frontend/lib/`. Déploiement : `bash /opt/ris-pro/server/install.sh` (cf. `server/README.md`).
- **BDD** : PostgreSQL 16 sur le serveur (`server/db/`), sauvegardes chiffrées chez OVHcloud
- **Authentification** : comptes gérés par RIS Pro (mots de passe scrypt, sessions par cookie, e-mails Brevo) — voir `server/AUTH.md`
- **Paiement** : Stripe
- **Analyse d'un relevé** (`frontend/api/analyze.js`) :
  1. Lecture du PDF par Gemini (Vertex AI, point d'accès Union européenne)
  2. Calcul des trimestres, des anomalies et de l'estimation de pension en JavaScript
  3. Rédaction du bilan par Gemini, en premium uniquement (textes modèles en freemium) — configuration : `server/GEMINI.md`
- **Conservation des relevés (RGPD)** : les PDF déposés sont supprimés automatiquement 6 mois après leur dépôt (stockage OVHcloud, et copie en base pour les anciens dépôts) par `/api/cleanup-files`, appelé chaque jour par le minuteur systemd `ris-pro-cleanup` et protégé par la variable d'environnement `CRON_SECRET`.
- **Veille réglementaire** : `backend/regulatory_watch_agent.py` (Gemini sur Vertex AI, avec la recherche Google), exécuté chaque lundi par `.github/workflows/regulatory-watch-v2.yml`. Il met à jour les fichiers `regles_*.md` via une pull request.

## Développement
- `cd frontend && npm run dev` : frontend en local
- `cd frontend && npm test` : tests unitaires de l'API
