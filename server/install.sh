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
id ris >/dev/null 2>&1 || useradd --system --create-home --home-dir "$APP_DIR" --shell /usr/sbin/nologin ris

echo "==> Code de l'application"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u ris git clone "$REPO_URL" "$APP_DIR"
else
  sudo -u ris git -C "$APP_DIR" pull --ff-only
fi

echo "==> Compilation du site"
set -a; . /etc/ris-pro/env; set +a
sudo -u ris --preserve-env=VITE_CLERK_PUBLISHABLE_KEY,NEXT_PUBLIC_SITE_URL,DATABASE_URL,CLERK_SECRET_KEY \
  bash -c "cd $APP_DIR/frontend && npm ci && npm run build"

echo "==> Services"
install -m 0644 "$APP_DIR/server/systemd/ris-pro.service" /etc/systemd/system/
install -m 0644 "$APP_DIR/server/systemd/ris-pro-cleanup.service" /etc/systemd/system/
install -m 0644 "$APP_DIR/server/systemd/ris-pro-cleanup.timer" /etc/systemd/system/
chmod 600 /etc/ris-pro/env
chown root:root /etc/ris-pro/env
systemctl daemon-reload
systemctl enable --now ris-pro.service ris-pro-cleanup.timer

echo "==> HTTPS (Caddy)"
if [ -z "${RIS_DOMAIN:-}" ]; then echo "RIS_DOMAIN doit être renseigné dans /etc/ris-pro/env."; exit 1; fi
# Caddy ne lit pas /etc/ris-pro/env : le domaine est écrit directement dans sa configuration.
sed "s|{\$RIS_DOMAIN}|${RIS_DOMAIN}|" "$APP_DIR/server/Caddyfile" > /etc/caddy/Caddyfile
systemctl restart caddy

echo "==> Pare-feu"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Installation terminée. Test : curl -I https://${RIS_DOMAIN}"
