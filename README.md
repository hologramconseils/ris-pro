# RIS Pro - Moteur d'Analyse Retraite

## Architecture
- **Frontend** : React + Vite (`frontend/src`)
- **API** : fonctions serverless Node.js sur Vercel (`frontend/api`), déployées via `vercel.json`. Chaque fichier de `frontend/api/` est une fonction (12 au maximum sur le plan Hobby) : les modules partagés vont dans `frontend/lib/`.
- **BDD** : PostgreSQL Neon (`neon_schema.sql`)
- **Authentification** : Clerk
- **Paiement** : Stripe
- **Analyse d'un relevé** (`frontend/api/analyze.js`) :
  1. Extraction du PDF par Mistral OCR
  2. Calcul des trimestres, des anomalies et de l'estimation de pension en JavaScript
  3. Rédaction du bilan par Mistral Large, en premium uniquement (textes modèles en freemium)
- **Conservation des relevés (RGPD)** : les PDF déposés sont supprimés automatiquement 6 mois après leur dépôt (Vercel Blob et copie en base) par la tâche planifiée Vercel `/api/cleanup-files` (`vercel.json`, « crons »), protégée par la variable d'environnement `CRON_SECRET`.
- **Veille réglementaire** : `backend/regulatory_watch_agent.py` (Mistral, avec recherche web), exécuté chaque jour par `.github/workflows/regulatory-watch-v2.yml`. Il met à jour les fichiers `regles_*.md` via une pull request.

## Développement
- `cd frontend && npm run dev` : frontend en local
- `cd frontend && npm test` : tests unitaires de l'API
