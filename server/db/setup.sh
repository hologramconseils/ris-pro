#!/usr/bin/env bash
# Installe PostgreSQL sur le serveur RIS (écoute locale uniquement) et crée la base « ris ».
# À lancer en root, une seule fois. Le mot de passe de la base est généré ici et écrit dans
# /etc/ris-pro/db-local.url (lisible par root seul) : il n'est jamais affiché.
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "Lancer ce script en root."; exit 1; fi

echo "==> Paquets (PostgreSQL, outils de sauvegarde)"
apt-get update
apt-get install -y postgresql postgresql-client awscli gnupg
systemctl enable --now postgresql

echo "==> Base et utilisateur « ris »"
cd /
URL_FILE=/etc/ris-pro/db-local.url
if [ ! -s "$URL_FILE" ]; then
  PW="$(openssl rand -hex 24)"
  if [ "$(runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='ris'")" = "1" ]; then
    runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER ROLE ris LOGIN PASSWORD '$PW'"
  else
    runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE ROLE ris LOGIN PASSWORD '$PW'"
  fi
  if [ "$(runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='ris'")" != "1" ]; then
    runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ris OWNER ris"
  fi
  (umask 077; printf 'postgresql://ris:%s@127.0.0.1:5432/ris\n' "$PW" > "$URL_FILE")
  unset PW
fi

echo "==> Contrôle : la base ne doit écouter qu'en local"
if ss -ltn | awk '$4 ~ /:5432$/ {print $4}' | grep -v -E '^(127\.0\.0\.1|\[::1\]):5432$' | grep -q .; then
  echo "ERREUR : PostgreSQL écoute sur autre chose que localhost. Arrêt, vérifier listen_addresses."
  exit 1
fi
install -d -m 700 /var/backups/ris
echo "PostgreSQL est prêt (accessible depuis ce serveur uniquement)."
echo "Étape suivante : bash /opt/ris-pro/server/db/migrate-from-neon.sh"
