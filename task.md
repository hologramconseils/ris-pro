# Liste des tâches - Stabilisation, Performance & Sécurité

## Performance
- [x] Optimiser les modèles d'analyse IA dans `frontend/api/analyze.js`
- [x] Optimiser le chargement de la police Inter dans `frontend/index.html` et `frontend/src/index.css`
- [x] Mettre en place le Lazy Loading des routes React dans `frontend/src/App.jsx`
- [x] Configurer la région de déploiement Vercel dans `vercel.json`
- [x] Valider la compilation du projet avec `npm run build`
- [x] Déployer en production sur GitHub / Vercel et vérifier

## Sécurité & Robustesse Backend
- [ ] Résoudre SEC-004 : Utiliser l'appel RPC Supabase `increment_credits` dans `frontend/api/webhook.js` au lieu de la lecture/écriture non atomique
- [ ] Résoudre SEC-003 : Retirer les fichiers `.env.production`, `.env.vercel` et `.env.vercel.production` du suivi de Git (`git rm --cached`)
- [ ] Mettre à jour `supabase_migration.sql` pour redéfinir `increment_credits` de manière résiliente avec `ON CONFLICT`
- [ ] Valider la compilation locale (`npm run build`)
- [ ] Commiter, pousser sur GitHub/Vercel et finaliser le walkthrough
