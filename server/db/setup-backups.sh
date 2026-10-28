#!/usr/bin/env bash
# Active les sauvegardes quotidiennes : demande la phrase secrète de chiffrement, fait une première
# sauvegarde pour vérifier que tout fonctionne, puis programme les suivantes (tous les jours à 02:30 UTC).
# Prérequis : OVH_BACKUP_BUCKET renseigné dans /etc/ris-pro/env (conteneur OVHcloud privé).
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "Lancer ce script en root."; exit 1; fi
APP_DIR=/opt/ris-pro
PASS=/etc/ris-pro/backup-passphrase

if [ ! -s "$PASS" ]; then
  echo "Choisissez une phrase secrète pour chiffrer les sauvegardes."
  echo "IMPORTANT : conservez-la aussi en dehors du serveur (gestionnaire de mots de passe). Sans elle, les sauvegardes sont illisibles."
  read -rsp "Phrase secrète : " P1; echo
  read -rsp "Confirmez : " P2; echo
  [ "$P1" = "$P2" ] || { echo "Les deux saisies diffèrent."; exit 1; }
  [ "${#P1}" -ge 16 ] || { echo "Trop courte : 16 caractères minimum."; exit 1; }
  (umask 077; printf '%s' "$P1" > "$PASS")
  unset P1 P2
fi

chmod +x "$APP_DIR/server/db/backup.sh"
echo "==> Première sauvegarde (test complet : export, chiffrement, envoi)"
"$APP_DIR/server/db/backup.sh"

install -m 0644 "$APP_DIR/server/systemd/ris-pro-backup.service" /etc/systemd/system/
install -m 0644 "$APP_DIR/server/systemd/ris-pro-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ris-pro-backup.timer
echo "Sauvegardes quotidiennes activées. Test de restauration conseillé : bash $APP_DIR/server/db/restore-test.sh"
