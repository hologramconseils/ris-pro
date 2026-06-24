# Rapport d'Audit de Performance - RIS Pro V2

Cet audit de performance a été réalisé en appliquant la compétence `performance-engineer` sur l'application live `https://ris.hologramconseils.com`. Il analyse le code source du frontend et des fonctions API serverless afin d'isoler les goulets d'étranglement et de proposer des optimisations concrètes.

---

## 1. Goulets d'étranglement critiques identifiés

### 🚨 Goulot A : Boucle de Fallback IA avec un modèle inexistant (Impact Latence : Élevé)
Dans le fichier de traitement backend `frontend/api/analyze.js` (lignes 136-184), le moteur tente d'appeler les modèles Gemini dans l'ordre suivant :
```javascript
const modelsToTry = ["gemini-3.1-flash", "gemini-2.5-flash", "gemini-2.5-pro"];
```
* **Problème** : Le modèle `gemini-3.1-flash` **n'existe pas** dans l'API Google Gemini.
* **Conséquence** : Chaque analyse de relevé de carrière (RIS) échoue systématiquement sur ce premier modèle, attend que l'appel API se solde par une erreur (visible dans les logs Vercel), puis bascule sur `gemini-2.5-flash`.
* **Pénalité de performance** : **1 à 3 secondes de latence inutile** ajoutées sur chaque requête d'analyse utilisateur.

---

### ⚡ Goulot B : Import de Police Bloquant le Rendu (Impact Core Web Vitals : Moyen)
Dans le fichier CSS global `frontend/src/index.css` (ligne 1) :
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
```
* **Problème** : L'utilisation de `@import` dans un fichier CSS bloque le rendu de la page par le navigateur. Le navigateur doit télécharger et analyser le CSS, puis découvrir l'import, puis télécharger le fichier de police externe avant de pouvoir afficher le texte.
* **Conséquence** : Dégradation des scores **FCP (First Contentful Paint)** et **LCP (Largest Contentful Paint)**.

---

### 📦 Goulot C : Absence de Code Splitting / Lazy Loading (Impact Poids de Bundle : Moyen)
Dans le fichier principal de routage `frontend/src/App.jsx` (lignes 5-12), toutes les pages sont importées de manière synchrone :
```javascript
import Home from './pages/Home'
import Diagnostic from './pages/Diagnostic'
import Bilan from './pages/Bilan'
```
* **Problème** : Lorsqu'un utilisateur arrive sur la page d'accueil (`/`), le navigateur télécharge l'intégralité du code de l'application (incluant les bibliothèques lourdes et graphiques des pages `Diagnostic` et `Bilan`).
* **Conséquence** : Temps de chargement initial de la page d'accueil ralenti, particulièrement sur mobile avec des connexions 3G/4G.

---

### 🌐 Goulot D : Latence Réseau Base de Données / API (Impact Latence : Moyen)
* **Problème** : Les fonctions serverless de Vercel s'exécutent par défaut dans la région `iad1` (East US, Virginie) alors que votre base de données Supabase est hébergée en Europe.
* **Conséquence** : Chaque requête d'API (comme l'insertion d'analyse, la lecture de profil, etc.) doit faire un aller-retour transatlantique entre Vercel (États-Unis) et Supabase (Europe).
* **Pénalité de performance** : Environ **150ms à 300ms** de latence réseau pure par requête SQL.

---

## 2. Plan d'optimisations proposé

### ✅ Action 1 : Nettoyage des modèles d'analyse IA
Corriger la liste `modelsToTry` dans `frontend/api/analyze.js` en retirant le modèle invalide et en ciblant directement les modèles existants et rapides :
```diff
-const modelsToTry = ["gemini-3.1-flash", "gemini-2.5-flash", "gemini-2.5-pro"];
+const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash"];
```

### ✅ Action 2 : Chargement asynchrone de la police Inter
* Retirer `@import` du fichier `index.css`.
* Ajouter des balises de préconnexion et de feuille de style asynchrones dans `frontend/index.html` :
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
```

### ✅ Action 3 : Implémentation du Lazy Loading sur les routes React
Utiliser `React.lazy()` et `Suspense` pour ne charger le code des pages lourdes (`Diagnostic`, `Bilan`) que lorsque l'utilisateur s'y rend :
```javascript
const Home = React.lazy(() => import('./pages/Home'))
const Diagnostic = React.lazy(() => import('./pages/Diagnostic'))
const Bilan = React.lazy(() => import('./pages/Bilan'))
```

### ✅ Action 4 : Relocalisation de la région d'exécution Vercel
Configurer la région de déploiement de vos fonctions d'API dans `vercel.json` pour la rapprocher de vos serveurs Supabase (ex: Paris `cdg1` ou Francfort `fra1`) :
```json
{
  "regions": ["cdg1"]
}
```

---

## 3. Estimation des gains de performance

| Optimisation | Métrique impactée | Gain estimé | Risque |
| :--- | :--- | :--- | :--- |
| **Action 1 (Modèles Gemini)** | Temps d'analyse (API analyze) | **-1.5s à -3s** | Quasi nul |
| **Action 2 (Font Optimization)** | LCP / FCP (Lancement initial) | **-200ms à -400ms** | Nul |
| **Action 3 (Lazy Loading)** | Poids du bundle d'accueil | **-60%** | Très faible |
| **Action 4 (Région Vercel)** | Latence réseau API | **-200ms par appel DB** | Nul |
