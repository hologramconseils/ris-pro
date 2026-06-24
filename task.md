# Liste des tâches - Stabilisation, Performance & Sécurité

## Performance
- [x] Optimiser les modèles d'analyse IA dans `frontend/api/analyze.js`
- [x] Optimiser le chargement de la police Inter dans `frontend/index.html` et `frontend/src/index.css`
- [x] Mettre en place le Lazy Loading des routes React dans `frontend/src/App.jsx`
- [x] Configurer la région de déploiement Vercel dans `vercel.json`
- [x] Valider la compilation du projet avec `npm run build`
- [x] Déployer en production sur GitHub / Vercel et vérifier

## Sécurité & Robustesse Backend
- [x] Résoudre SEC-004 : Utiliser l'appel RPC Supabase `increment_credits` dans `frontend/api/webhook.js` au lieu de la lecture/écriture non atomique
- [x] Résoudre SEC-003 : Retirer les fichiers `.env.production`, `.env.vercel` et `.env.vercel.production` du suivi de Git (`git rm --cached`)
- [x] Mettre à jour `supabase_migration.sql` pour redéfinir `increment_credits` de manière résiliente avec `ON CONFLICT`
- [x] Valider la compilation locale (`npm run build`)
- [x] Commiter, pousser sur GitHub/Vercel et finaliser le walkthrough

## Ergonomie & Optimisation Mobile (mobile-design)
- [x] Agrandir les zones tactiles des boutons (ThemeToggle et Menu hamburger) à 44px (Header.jsx)
- [x] Adapter textuellement l'instruction d'upload sur mobile (Home.jsx)
- [x] Rendre les boutons du bilan empilables sur mobile (Bilan.jsx et index.css)
- [x] Ajouter la variable de bordure `--border` manquante dans index.css
- [x] Valider la compilation locale avec `npm run build`
- [ ] Commiter, pousser sur GitHub/Vercel et vérifier
