#!/usr/bin/env bash
#
# Sammelt alles, was für die Einrichtung auf dem Raspberry Pi wichtig ist:
# Modell, System, Sitzungsart, Display und Touch-Eingabe.
#
# Aufruf auf dem Pi:   bash deploy/rubicon-check.sh
#
# Gibt nur aus, ändert nichts. Enthält keine Zugangsdaten — die Ausgabe
# kann bedenkenlos weitergegeben werden.

set -uo pipefail

titel() { printf '\n\033[1m%s\033[0m\n' "$1"; }
wert()  { printf '  %-22s %s\n' "$1" "$2"; }

titel "Gerät"
modell="$( { tr -d '\0' < /proc/device-tree/model; } 2>/dev/null )"
wert "Modell" "${modell:-unbekannt (kein Raspberry Pi?)}"
case "$(uname -m)" in
  aarch64)         arch_hinweis='64-bit, richtig fuer diese App' ;;
  armv7l|armv6l)   arch_hinweis='32-bit! Bitte 64-bit-Image verwenden' ;;
  *)               arch_hinweis='kein Raspberry-Pi-Prozessor' ;;
esac
wert "Architektur" "$(uname -m)   ($arch_hinweis)"
wert "Arbeitsspeicher" "$(awk '/MemTotal/ {printf "%.1f GB", $2/1024/1024}' /proc/meminfo)"

titel "System"
wert "OS" "$(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || echo unbekannt)"
wert "Node" "$(command -v node >/dev/null && node -v || echo 'nicht installiert')"
wert "npm" "$(command -v npm >/dev/null && npm -v || echo 'nicht installiert')"

titel "Sitzung (entscheidet über den Autostart)"
sitzung="${XDG_SESSION_TYPE:-unbekannt}"
wert "Typ" "$sitzung"
compositor='keiner erkannt'
for p in labwc wayfire mutter Xorg; do
  pgrep -x "$p" >/dev/null 2>&1 && compositor="$p" && break
done
wert "Compositor" "$compositor"
case "$compositor" in
  labwc)   wert "-> Autostart" "~/.config/labwc/autostart" ;;
  wayfire) wert "-> Autostart" "~/.config/wayfire.ini  [autostart]" ;;
  Xorg)    wert "-> Autostart" "~/.config/lxsession/LXDE-pi/autostart" ;;
  *)       wert "-> Autostart" "erst im Desktop ausführen, dann erneut prüfen" ;;
esac

titel "Display"
gefunden=0
for s in /sys/class/drm/card*-*/status; do
  [ -r "$s" ] || continue
  [ "$(cat "$s")" = connected ] || continue
  aus="$(basename "$(dirname "$s")")"
  aufl="$(head -n1 "$(dirname "$s")/modes" 2>/dev/null || echo '?')"
  wert "${aus#card*-}" "$aufl"
  gefunden=1
done
[ "$gefunden" -eq 0 ] && wert "-" "kein angeschlossenes Display erkannt"

titel "Toucheingabe"
if [ -r /proc/bus/input/devices ]; then
  touch_geraete="$(grep -i '^N: Name=' /proc/bus/input/devices \
    | grep -iE 'touch|ft5406|goodix|edt|ilitek|hid.*digitizer' \
    | sed 's/^N: Name="//; s/"$//')"
  if [ -n "$touch_geraete" ]; then
    echo "$touch_geraete" | while IFS= read -r g; do wert "erkannt" "$g"; done
  else
    wert "-" "kein Touch-Gerät gefunden (Panel angeschlossen und an?)"
  fi
else
  wert "-" "/proc/bus/input/devices nicht lesbar"
fi

titel "Dashboard"
if command -v curl >/dev/null && curl -fsS --max-time 2 localhost:4000/api/health >/dev/null 2>&1; then
  wert "Server" "läuft auf Port 4000"
else
  wert "Server" "antwortet nicht (noch nicht gestartet?)"
fi
if command -v systemctl >/dev/null; then
  if systemctl cat rubicon-dashboard >/dev/null 2>&1; then
    wert "Dienst" "$(systemctl is-active rubicon-dashboard 2>/dev/null)"
  else
    wert "Dienst" "nicht eingerichtet"
  fi
fi
ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
wert "Adresse im Netz" "http://${ip:-$(hostname).local}:4000"

echo
