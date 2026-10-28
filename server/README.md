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

## Tester avec le vrai domaine avant la bascule
1. Dans `/etc/ris-pro/env`, mettre le vrai domaine dans `RIS_DOMAIN` et `RIS_TLS=internal` (certificat provisoire).
2. Sur votre Mac, rediriger **uniquement votre poste** vers le serveur : `sudo nano /etc/hosts`, ajouter la ligne `89.167.64.150 ris.hologramconseils.com`, enregistrer.
3. Ouvrir le domaine dans le navigateur : un avertissement de certificat apparaît (normal), cliquer sur « Avancé » puis continuer. Vos clients, eux, continuent d'utiliser Vercel.
4. Après les tests, supprimer cette ligne de `/etc/hosts`.
5. Pour la bascule : vider `RIS_TLS`, relancer `install.sh`, puis changer l'enregistrement DNS.

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
bash /opt/ris-pro/server/install.sh   # recompile et redémarre (lit /etc/ris-pro/env sans l'exécuter)
sudo systemctl restart ris-pro
```

## Bascule depuis Vercel (à faire seulement après les tests)
1. Tester sur le domaine de test : analyse, paiement Stripe en mode test, e-mail, page bilan.
2. Changer l'enregistrement DNS du domaine vers le serveur.
3. Garder Vercel en réserve quelques jours, puis supprimer le projet.

## Base de données PostgreSQL sur le serveur (remplace Neon)
La base tourne sur le serveur lui-même, accessible depuis cette machine uniquement (le port 5432 n'est jamais ouvert).
Le site accepte les deux types de base : une adresse `neon.tech` utilise le pilote Neon, toute autre adresse utilise PostgreSQL classique (`lib/db.js`).

```bash
# en root, dans cet ordre
bash /opt/ris-pro/server/install.sh                   # installe le code qui sait parler à PostgreSQL local
bash /opt/ris-pro/server/db/setup.sh                  # installe PostgreSQL, crée la base « ris »
bash /opt/ris-pro/server/db/migrate-from-neon.sh      # copie Neon vers le serveur, vérifie, puis bascule
bash /opt/ris-pro/server/db/setup-backups.sh          # sauvegardes chiffrées quotidiennes vers OVHcloud
bash /opt/ris-pro/server/db/restore-test.sh           # prouve qu'une sauvegarde se restaure
```

- `migrate-from-neon.sh` demande l'adresse **directe** de Neon (sans `-pooler`), arrête le site pendant le transfert (quelques minutes), compare le nombre de lignes de chaque table et ne bascule que si tout correspond. En cas d'échec, le site repart sur Neon, qui n'est jamais modifié.
- Les sauvegardes sont chiffrées (AES-256) avec une phrase secrète que vous choisissez et conservez **en dehors du serveur** ; sans elle, elles sont illisibles. Elles sont copiées chaque nuit (02:30 UTC) dans un conteneur OVHcloud privé : 14 jours conservés sur le serveur, 30 jours chez OVHcloud.
- Neon n'est supprimé qu'après quelques jours de bon fonctionnement.
