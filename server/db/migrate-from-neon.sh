#!/usr/bin/env bash
# Transfère la base Neon vers le PostgreSQL local, vérifie le contenu table par table, puis bascule
# le site. Neon n'est jamais modifié ni supprimé : en cas de problème, le site reprend sur Neon.
# À lancer en root, après setup.sh. L'adresse de Neon est demandée sans être affichée.
set -Eeuo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "Lancer ce script en root."; exit 1; fi
URL_FILE=/etc/ris-pro/db-local.url
[ -s "$URL_FILE" ] || { echo "Base locale absente : lancer d'abord setup.sh."; exit 1; }
LOCAL="$(cat "$URL_FILE")"

echo "Dans Neon : Connect, puis désactiver « Connection pooling » pour obtenir l'adresse DIRECTE (sans « -pooler »)."
read -rsp "Adresse (URL) directe de la base Neon : " NEON; echo
case "$NEON" in postgresql://*|postgres://*) ;; *) echo "Refusé : ce n'est pas une adresse PostgreSQL."; exit 1;; esac
case "$NEON" in *-pooler*) echo "Refusé : adresse « pooler ». Utiliser l'adresse directe (pg_dump ne fonctionne pas via le pooler)."; exit 1;; esac

DUMP="$(mktemp /var/backups/ris/neon-XXXXXX.dump)"
chmod 600 "$DUMP"
cleanup() { shred -u "$DUMP" 2>/dev/null || rm -f "$DUMP"; }
on_error() { echo; echo "ÉCHEC : le site est relancé avec l'ancienne base (Neon), rien n'a été basculé."; systemctl start ris-pro || true; cleanup; }
trap on_error ERR

echo "==> Arrêt du site (les écritures sont gelées pendant le transfert)"
systemctl stop ris-pro

echo "==> Export depuis Neon"
pg_dump --format=custom --no-owner --no-privileges --file="$DUMP" "$NEON"

echo "==> Import dans la base locale"
pg_restore --no-owner --no-privileges --clean --if-exists --exit-on-error --dbname="$LOCAL" "$DUMP"

echo "==> Comparaison du contenu (nombre de lignes par table)"
BAD=0
while IFS= read -r t; do
  a="$(psql "$NEON" -At -c "SELECT count(*) FROM public.\"$t\"")"
  b="$(psql "$LOCAL" -At -c "SELECT count(*) FROM public.\"$t\"")"
  if [ "$a" = "$b" ]; then s="OK"; else s="DIFFÉRENT"; BAD=1; fi
  printf '%-28s Neon=%-8s Local=%-8s %s\n' "$t" "$a" "$b" "$s"
done < <(psql "$LOCAL" -At -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")
if [ "$BAD" -ne 0 ]; then echo "Des tables diffèrent : bascule annulée."; false; fi

echo "==> Bascule du site sur la base locale"
sed -i '/^DATABASE_URL=/d' /etc/ris-pro/env
printf 'DATABASE_URL=%s\n' "$LOCAL" >> /etc/ris-pro/env
trap - ERR
cleanup
systemctl start ris-pro
sleep 3
systemctl is-active ris-pro
echo "Terminé. Neon est resté intact et n'est plus utilisé : à supprimer après quelques jours de bon fonctionnement."
echo "Étape suivante : bash /opt/ris-pro/server/db/setup-backups.sh"
