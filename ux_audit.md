# Rapport d'Audit UX - RIS Pro

Ce rapport évalue l'utilisabilité de l'application **RIS Pro** (https://ris.hologramconseils.com) à l'aide des 10 heuristiques de Nielsen et des meilleures pratiques UX mobiles/tablettes.

---

## 1. Tableau de Synthèse des Problèmes UX

| Réf | Heuristique de Nielsen | Problème UX identifié | Sévérité | Impact Utilisateur | Suggestion de Résolution |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UX-001** | *Visibility of system status* / *Flexibility* | **Export PDF fictif (Alerte JS)**<br>Le bouton "Exporter PDF" affiche une simple alerte `alert()` au lieu de générer le document. | 🟠 **Moyen** | Déception de l'utilisateur qui s'attend à récupérer un rapport téléchargeable après avoir payé 29 €. | Remplacer l'alerte par `window.print()` et concevoir une feuille de style CSS d'impression (`@media print`) pour formater le bilan de manière professionnelle. |
| **UX-002** | *User control & freedom* / *Flexibility* | **Friction de connexion après achat (Utilisateurs existants)**<br>Si un client existant achète un pack en étant déconnecté, il ne reçoit pas de lien magique de connexion directe et doit saisir son mot de passe. | 🟠 **Moyen** | Rupture du parcours utilisateur et frustration s'il a oublié ses identifiants. | Générer et envoyer un lien de connexion magique à usage unique dans l'email de confirmation, qu'il soit nouveau ou ancien client. |
| **UX-003** | *User control & freedom* | **Absence de retour rapide au téléversement**<br>Sur la page du Bilan Premium, il n'y a pas de bouton pour démarrer une nouvelle analyse. | 🟡 **Faible** | L'utilisateur doit deviner qu'il faut cliquer sur "Accueil" ou sur le logo dans l'entête pour relancer un scan. | Ajouter un bouton secondaire "Analyser un autre document" en haut ou en bas de la page du Bilan. |
| **UX-004** | *Flexibility & efficiency* / *Cognitive load* | **Surcharge cognitive sur les longs bilans**<br>Si un utilisateur a de nombreuses anomalies, la liste est très longue et impossible à filtrer ou trier. | 🟡 **Faible** | Difficulté à prioriser les démarches correctives (le regard se perd dans la liste). | Ajouter des filtres rapides (ex: "Toutes", "Critiques 🔴", "Moyennes 🟡") en tête de liste pour affiner l'affichage. |

---

## 2. Détail des Recommandations & Maquettes d'Implémentation

### 📄 UX-001 : Implémentation d'un véritable Export PDF via `window.print()`
* **Fichier concerné :** `frontend/src/pages/Bilan.jsx` & `frontend/src/index.css`
* **Concept** : Plutôt que de développer un moteur lourd de génération PDF côté serveur (comme PDFKit ou Puppeteer), nous exploitons le moteur de rendu natif du navigateur (`window.print()`).
* **Feuille de style d'impression** : 
  Dans le CSS, nous masquons les éléments d'interface inutiles à la lecture (entête, pied de page, boutons de navigation) et optimisons les marges pour générer un document propre, paginé et prêt à être sauvegardé au format PDF par le système de l'appareil de l'utilisateur.

### 🔑 UX-002 : Simplification du parcours de reconnexion post-achat
* **Fichier concerné :** `frontend/api/webhook.js`
* **Concept** : Lors de la réception de l'événement de paiement réussi, le webhook doit systématiquement générer un lien magique de connexion temporaire via l'API Supabase GoTrue, y compris si l'utilisateur existait déjà. Cela permet d'inclure le bouton d'accès direct "Consulter mon Bilan Premium" dans l'email de confirmation de commande pour TOUS les utilisateurs.

### 🔄 UX-003 : Fluidification de la navigation retour
* **Fichier concerné :** `frontend/src/pages/Bilan.jsx`
* **Concept** : Ajouter un bouton "Analyser un autre document" (dirigeant vers `/`) à côté des boutons de génération de courriers et d'export. Sur mobile, cela permet de conserver un flux d'interaction circulaire et évite de dépendre uniquement des boutons de retour physique ou de la barre d'entête.
