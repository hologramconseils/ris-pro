# Gemini sur Vertex AI (remplace Mistral)

La lecture des relevés PDF et la rédaction du bilan premium (`frontend/api/analyze.js`, via
`frontend/lib/vertexAI.js`) ainsi que la veille réglementaire hebdomadaire
(`backend/regulatory_watch_agent.py`) utilisent Gemini sur **Vertex AI** (Google Cloud).

- **Relevés de carrière** : point d'accès **« eu »** (multi-région Union européenne,
  `aiplatform.eu.rep.googleapis.com`), où le traitement reste dans les États membres de l'UE. Le code
  refuse le point d'accès « global », qui ne garantit pas le lieu du traitement.
- **Veille réglementaire** : point d'accès « global » par défaut (`VERTEX_WATCH_LOCATION`), car elle
  n'envoie que les règles publiques des fichiers `regles_*.md`, sans aucune donnée personnelle, et la
  recherche Google y est la plus largement disponible.
- **Modèle** : `gemini-3.5-flash` par défaut. Il se change sans toucher au code (`GEMINI_EXTRACT_MODEL`,
  `GEMINI_WRITER_MODEL`, `GEMINI_WATCH_MODEL`), par exemple quand Google annonce son retrait. Avant de
  changer, vérifier dans la page du modèle (documentation Vertex AI) qu'il est proposé sur le point d'accès
  « eu ».

## Mise en place (une fois)

1. **Projet Google Cloud** : console.cloud.google.com → créer un projet (ex. `ris-pro`), puis associer un
   compte de facturation.
2. **Activer l'API** : « API et services » → activer **Vertex AI API** (`aiplatform.googleapis.com`).
3. **Compte de service** : « IAM et administration » → « Comptes de service » → créer `ris-pro-gemini`,
   rôle **Vertex AI User** (`roles/aiplatform.user`) et rien d'autre.
4. **Clé** : sur ce compte de service, « Clés » → « Ajouter une clé » → JSON. Le fichier téléchargé est
   un secret : ne jamais l'envoyer par e-mail, ni dans une conversation, ni le déposer dans le dépôt.
   Si Google refuse la création de clé (règle d'organisation `iam.disableServiceAccountKeyCreation`), la
   lever pour ce seul projet depuis Cloud Shell (fait le 1er novembre 2026) :
   ```
   gcloud organizations add-iam-policy-binding <ID_ORGANISATION> --member=user:<votre-adresse> --role=roles/orgpolicy.policyAdmin --condition=None
   gcloud resource-manager org-policies disable-enforce iam.disableServiceAccountKeyCreation --project=ris-pro
   gcloud config set project ris-pro && gcloud services enable orgpolicy.googleapis.com
   printf 'name: projects/ris-pro/policies/iam.managed.disableServiceAccountKeyCreation\nspec:\n  rules:\n  - enforce: false\n' > /tmp/regle.yaml
   gcloud org-policies set-policy /tmp/regle.yaml --billing-project=ris-pro
   ```
5. **Serveur** : copier la clé depuis le Mac, puis la protéger :
   ```
   scp ~/Downloads/<fichier-de-cle>.json root@89.167.64.150:/etc/ris-pro/google-service-account.json
   chown root:ris /etc/ris-pro/google-service-account.json && chmod 640 /etc/ris-pro/google-service-account.json
   ```
   puis ajouter à `/etc/ris-pro/env` :
   ```
   GOOGLE_SERVICE_ACCOUNT_FILE=/etc/ris-pro/google-service-account.json
   VERTEX_LOCATION=eu
   ```
   et redéployer (`install.sh` redémarre le service). Supprimer ensuite le fichier de clé du Mac.
6. **Veille (GitHub)** : dépôt → Settings → Secrets and variables → Actions → nouveau secret
   `GOOGLE_SERVICE_ACCOUNT_JSON` contenant le texte complet du fichier de clé. Lancer le workflow
   « Veille Réglementaire Automatique » à la main (Actions → Run workflow) pour vérifier.
7. **Aucune conservation chez Google** : Vertex AI garde par défaut les requêtes en cache (jusqu'à 24 h). Cache
   désactivé pour le projet le 1er novembre 2026 (documentation Vertex AI, page « Zero data retention »),
   depuis Cloud Shell :
   ```
   curl -s -X PATCH -H "Authorization: Bearer $(gcloud auth print-access-token)" -H "Content-Type: application/json" \
     https://us-central1-aiplatform.googleapis.com/v1/projects/ris-pro/cacheConfig \
     -d '{"name":"projects/ris-pro/cacheConfig","disableCache":true}'
   ```
   Vérification : la même adresse en GET doit répondre `"disableCache": true`.

## Après la bascule

- Vérifier une analyse complète (freemium puis premium) sur un relevé réel.
- Retirer `MISTRAL_API_KEY` de `/etc/ris-pro/env`, le secret GitHub `MISTRAL_API_KEY`, et supprimer les
  clés dans la console Mistral.
- Les extractions déjà mémorisées en base (colonne `analyses.extraction`) restent utilisées : un relevé déjà
  lu par Mistral n'est pas relu.
