# Hébergement de RIS Pro sur un serveur (hors Vercel)

Ce dossier permet de faire tourner RIS Pro sur un serveur Ubuntu classique, par exemple un VPS Hetzner en Europe.
Vercel reste la solution par défaut tant que ce dossier n'est pas utilisé.

## Contenu
- `index.mjs` : serveur Node qui sert le site compilé et lance les fonctions de `frontend/api/` sur `/api/<nom>`.
- `adapter.mjs` : prépare les requêtes et réponses pour les fonctions écrites pour Vercel.
- `Caddyfile` : HTTPS automatique (Let's Encrypt) devant le serveur Node.
- `systemd/` : service du site et tâche quotidienne de suppression des PDF (3h17 UTC).
- `install.sh` : installation complète sur un serveur Ubuntu neuf.
- `env.example` : liste des variables à renseigner (sans valeurs).

Les en-têtes de sécurité sont lus dans `vercel.json` : une seule source pour Vercel et le serveur.

## Avant d'installer
1. **Domaine** : chez votre registrar, créez un enregistrement DNS `A` pointant le domaine (par exemple `ris.hologramconseils.com`) vers l'IP du serveur. Ne basculez le domaine qu'après les tests complets.
2. **Clé de déploiement GitHub** : sur le serveur, créez une clé SSH dédiée, ajoutez la clé publique dans le dépôt GitHub (Settings → Deploy keys, en lecture seule), et configurez `~/.ssh/config` pour l'utiliser avec `github.com`.
3. **Variables** : copiez `server/env.example` vers `/etc/ris-pro/env` et remplissez les valeurs. Ce fichier contient les secrets : ne le partagez jamais.

## Installation
```bash
# en root, sur le serveur
apt-get install -y git
git clone git@github.com:hologramconseils/ris-pro.git /opt/ris-pro   # première fois seulement
bash /opt/ris-pro/server/install.sh
```
Le script installe Node 22, Caddy et le pare-feu, compile le site, et démarre les services.

## Vérifications
```bash
systemctl status ris-pro            # le service doit être « active (running) »
curl -I https://$RIS_DOMAIN         # doit répondre 200 avec un certificat valide
curl -s -X POST https://$RIS_DOMAIN/api/cleanup-files   # doit répondre « Non autorisé »
journalctl -u ris-pro -n 50         # journaux du site et de l'API
```

## Mise à jour
```bash
git -C /opt/ris-pro pull --ff-only && chown -R ris:ris /opt/ris-pro
cd /opt/ris-pro/frontend && set -a && . /etc/ris-pro/env && set +a && npm ci && npm run build
sudo systemctl restart ris-pro
```

## Bascule depuis Vercel (à faire seulement après les tests)
1. Tester sur le domaine de test : analyse, paiement Stripe en mode test, e-mail, page bilan.
2. Changer l'enregistrement DNS du domaine vers le serveur.
3. Garder Vercel en réserve quelques jours, puis supprimer le projet.
