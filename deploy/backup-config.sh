#!/usr/bin/env bash
# Taegliche Sicherung der Laufzeitdaten mit Geheimnissen.
#
# data/config.json traegt Home-Assistant-Token, AI-API-Key, Google-Refresh-
# Token und die private Kalender-ICS-Adresse — nichts davon steht in git.
# Dieses Skript legt lokal rotierende Kopien an (Schutz vor kaputten Edits,
# einem fehlgeschlagenen Google-Token-Refresh o.ä.). Das schuetzt NICHT vor
# einem Ausfall der SD-Karte selbst — dafuer zieht ein Timer auf Marcus'
# Hauptrechner diese Kopien regelmaessig ab (siehe docs/raspberry-pi.md).
#
# Cron (crontab -e, kein sudo noetig):
#   17 4 * * * /home/pi/rubicon/deploy/backup-config.sh >> /home/pi/rubicon/data/backups/backup.log 2>&1

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/data/config.json"
DEST_DIR="$ROOT/data/backups"
KEEP_DAYS=14

[ -f "$SRC" ] || { echo "$(date -Is) config.json fehlt — nichts zu sichern"; exit 0; }

mkdir -p "$DEST_DIR"
STAMP="$(date +%Y-%m-%d_%H%M)"
gzip -c "$SRC" > "$DEST_DIR/config-$STAMP.json.gz"
echo "$(date -Is) gesichert: config-$STAMP.json.gz"

# Aeltere Sicherungen als KEEP_DAYS Tage entfernen.
find "$DEST_DIR" -name 'config-*.json.gz' -mtime "+$KEEP_DAYS" -delete
