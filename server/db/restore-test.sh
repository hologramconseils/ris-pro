#!/usr/bin/env bash
# Vérifie qu'une sauvegarde est réellement restaurable : la déchiffre, la restaure dans une base
# temporaire (jamais dans la base du site), affiche le nombre de lignes par table, puis la supprime.
# Usage : bash restore-test.sh [fichier.dump.gpg]   (par défaut : la plus récente de /var/backups/ris)
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "Lancer ce script en root."; exit 1; fi
PASS=/etc/ris-pro/backup-passphrase
FILE="${1:-$(ls -1t /var/backups/ris/ris-*.dump.gpg 2>/dev/null | head -1)}"
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "Aucune sauvegarde trouvée."; exit 1; }
cd /
runuser -u postgres -- dropdb --if-exists ris_restoretest
runuser -u postgres -- createdb ris_restoretest
trap 'cd /; runuser -u postgres -- dropdb --if-exists ris_restoretest' EXIT
echo "==> Restauration de $(basename "$FILE") dans une base temporaire"
gpg --batch --quiet --decrypt --passphrase-file "$PASS" "$FILE" \
  | runuser -u postgres -- pg_restore --no-owner --no-privileges --exit-on-error --dbname=ris_restoretest
while IFS= read -r t; do
  printf '%-28s %s lignes\n' "$t" "$(runuser -u postgres -- psql -d ris_restoretest -At -c "SELECT count(*) FROM public.\"$t\"")"
done < <(runuser -u postgres -- psql -d ris_restoretest -At -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")
echo "Restauration réussie : la sauvegarde est exploitable. Base temporaire supprimée."
