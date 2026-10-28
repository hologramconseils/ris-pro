#!/usr/bin/env bash
# Installation de RIS Pro sur un serveur Ubuntu neuf (à lancer en root).
# Prérequis : /etc/ris-pro/env rempli (cf. server/env.example) et clé de déploiement GitHub en place.
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:hologramconseils/ris-pro.git}"
APP_DIR=/opt/ris-pro

if [ "$(id -u)" -ne 0 ]; then echo "Lancer ce script en root."; exit 1; fi
if [ ! -f /etc/ris-pro/env ]; then echo "Fichier /etc/ris-pro/env absent : voir server/env.example."; exit 1; fi

echo "==> Paquets système"
apt-get update
apt-get install -y git curl ca-certificates ufw caddy
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> Utilisateur dédié"
# Le dossier personnel (cache npm) est séparé de celui de l'application, qui doit rester vide avant le clonage.
id ris >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/ris --shell /usr/sbin/nologin ris

echo "==> Code de l'application"
# Le code est récupéré par root (qui détient la clé de déploiement), puis confié à l'utilisateur ris.
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  # Le fichier de verrouillage peut avoir été modifié ici par « npm install » (voir plus bas) : on le
  # remet à l'état du dépôt pour que la mise à jour du code ne soit jamais bloquée.
  git -C "$APP_DIR" checkout -- frontend/package-lock.json 2>/dev/null || true
  git -C "$APP_DIR" pull --ff-only
fi
chown -R ris:ris "$APP_DIR"

echo "==> Compilation du site"
# « npm ci » refuse de s'exécuter si package.json et le fichier de verrouillage divergent (ajout d'une
# dépendance sans mise à jour du verrou) : dans ce cas « npm install » prend le relais.
# Lecture du fichier de configuration SANS l'exécuter : « . fichier » interpréterait une valeur contenant
# un espace ou un « & » (ex. un nom avec espace, une adresse de base avec options) comme des commandes.
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|'#'*) continue ;; *=*) ;; *) continue ;; esac
  name="${line%%=*}"; value="${line#*=}"
  value="${value%\"}"; value="${value#\"}"
  export "$name=$value"
done < /etc/ris-pro/env
sudo -u ris --preserve-env=VITE_CLERK_PUBLISHABLE_KEY,NEXT_PUBLIC_SITE_URL,DATABASE_URL,CLERK_SECRET_KEY \
  bash -c "cd $APP_DIR/frontend && (npm ci || npm install --no-audit --no-fund) && npm run build"

echo "==> Services"
install -m 0644 "$APP_DIR/server/systemd/ris-pro.service" /etc/systemd/system/
install -m 0644 "$APP_DIR/server/systemd/ris-pro-cleanup.service" /etc/systemd/system/
install -m 0644 "$APP_DIR/server/systemd/ris-pro-cleanup.timer" /etc/systemd/system/
install -m 0644 "$APP_DIR/server/systemd/ris-pro-mail-keepalive.service" /etc/systemd/system/
install -m 0644 "$APP_DIR/server/systemd/ris-pro-mail-keepalive.timer" /etc/systemd/system/
chmod 600 /etc/ris-pro/env
chown root:root /etc/ris-pro/env
systemctl daemon-reload
systemctl enable --now ris-pro.service ris-pro-cleanup.timer ris-pro-mail-keepalive.timer

echo "==> HTTPS (Caddy)"
if [ -z "${RIS_DOMAIN:-}" ]; then echo "RIS_DOMAIN doit être renseigné dans /etc/ris-pro/env."; exit 1; fi
# Caddy ne lit pas /etc/ris-pro/env : le domaine est écrit directement dans sa configuration.
# RIS_TLS=internal : certificat provisoire (auto-signé) pour tester avec le vrai domaine avant la bascule du DNS.
# Vide : certificat Let's Encrypt (le domaine doit alors pointer vers ce serveur).
TLS_LINE="# certificat Let's Encrypt automatique"
if [ "${RIS_TLS:-}" = "internal" ]; then TLS_LINE="tls internal"; fi
sed -e "s|{\$RIS_DOMAIN}|${RIS_DOMAIN}|" -e "s|# TLS_LINE|${TLS_LINE}|" "$APP_DIR/server/Caddyfile" > /etc/caddy/Caddyfile
systemctl restart caddy

echo "==> Pare-feu"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Installation terminée. Test : curl -I https://${RIS_DOMAIN}"
