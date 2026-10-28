#!/usr/bin/env bash
# Sauvegarde chiffrée de la base RIS : export, chiffrement AES-256 (gpg), copie dans un conteneur
# OVHcloud privé (Gravelines). Conserve 14 jours sur le serveur et 30 jours chez OVHcloud.
# Lancé chaque nuit par ris-pro-backup.timer ; un échec est visible avec « systemctl status ris-pro-backup ».
set -euo pipefail
PASS=/etc/ris-pro/backup-passphrase
getenv() { grep -m1 "^$1=" /etc/ris-pro/env | cut -d= -f2- || true; }

[ -s "$PASS" ] || { echo "Phrase secrète de sauvegarde absente ($PASS)."; exit 1; }
ENDPOINT="$(getenv OVH_S3_ENDPOINT)"; REGION="$(getenv OVH_S3_REGION)"; BUCKET="$(getenv OVH_BACKUP_BUCKET)"
AK="$(getenv OVH_BACKUP_ACCESS_KEY)"; SK="$(getenv OVH_BACKUP_SECRET_KEY)"
[ -n "$AK" ] || AK="$(getenv OVH_S3_ACCESS_KEY)"
[ -n "$SK" ] || SK="$(getenv OVH_S3_SECRET_KEY)"
if [ -z "$ENDPOINT" ] || [ -z "$REGION" ] || [ -z "$BUCKET" ] || [ -z "$AK" ] || [ -z "$SK" ]; then
  echo "Configuration OVHcloud incomplète (OVH_S3_ENDPOINT, OVH_S3_REGION, OVH_BACKUP_BUCKET, clés)."; exit 1
fi

DIR=/var/backups/ris
install -d -m 700 "$DIR"
OUT="$DIR/ris-$(date -u +%Y%m%dT%H%M%SZ).dump.gpg"
cd /
runuser -u postgres -- pg_dump --format=custom ris \
  | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-file "$PASS" --output "$OUT"
if [ "$(stat -c %s "$OUT")" -lt 1024 ]; then echo "Sauvegarde anormalement petite : abandon."; rm -f "$OUT"; exit 1; fi

export AWS_ACCESS_KEY_ID="$AK" AWS_SECRET_ACCESS_KEY="$SK" AWS_DEFAULT_REGION="$REGION"
aws --endpoint-url "$ENDPOINT" s3 cp "$OUT" "s3://$BUCKET/db/$(basename "$OUT")" --only-show-errors
echo "Sauvegarde envoyée : $(basename "$OUT") ($(stat -c %s "$OUT") octets)"

find "$DIR" -name 'ris-*.dump.gpg' -mtime +14 -delete
CUTOFF="$(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%S)"
OLD="$(aws --endpoint-url "$ENDPOINT" s3api list-objects-v2 --bucket "$BUCKET" --prefix db/ \
  --query "Contents[?LastModified<'$CUTOFF'].Key" --output text 2>/dev/null || true)"
for key in $OLD; do
  [ "$key" = "None" ] && continue
  aws --endpoint-url "$ENDPOINT" s3 rm "s3://$BUCKET/$key" --only-show-errors
done
