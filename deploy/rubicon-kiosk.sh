#!/usr/bin/env bash
# Startet das Dashboard im Vollbild-Kiosk mit Chromium.
#
# Ablegen als /home/pi/rubicon/deploy/rubicon-kiosk.sh, ausführbar machen,
# und aus der Autostart-Datei der Desktop-Sitzung aufrufen.

set -euo pipefail

# Bewusst 127.0.0.1 statt localhost: Der Name löst auf ::1 UND 127.0.0.1 auf,
# der Server lauscht aber nur auf IPv4 (0.0.0.0). Chromium bevorzugt dann ::1,
# scheitert und zeigt eine weiße Seite — curl weicht auf IPv4 aus, Chromium
# nicht.
URL="${RUBICON_URL:-http://127.0.0.1:4000}"
PROFILE="$HOME/.config/chromium/Default/Preferences"

# Auf Raspberry Pi OS heißt die Binärdatei mal so, mal so.
BROWSER="$(command -v chromium-browser || command -v chromium)"

# Warten, bis der Server antwortet — sonst zeigt Chromium eine Fehlerseite,
# die im Kiosk-Modus niemand wegklicken kann.
warte_auf_server() {
  for _ in $(seq 1 60); do
    curl -sf -m 1 -o /dev/null "$URL/api/health" && return 0
    sleep 1
  done
  return 0
}

# Absturzmeldungen aus der letzten Sitzung entfernen: Chromium zeigt sonst
# beim Start einen Wiederherstellen-Balken über dem Dashboard.
saeubere_profil() {
  [ -f "$PROFILE" ] || return 0
  sed -i \
    -e 's/"exit_type":"Crashed"/"exit_type":"Normal"/' \
    -e 's/"exited_cleanly":false/"exited_cleanly":true/' \
    "$PROFILE" || true
}

# Unter Wayland (labwc, wayfire) muss Chromium ausdrücklich auf Ozone gestellt
# werden. Ohne das sucht es einen X-Server, findet keinen und beendet sich mit
# „Missing X server or $DISPLAY".
OZONE=()
if [ -n "${WAYLAND_DISPLAY:-}" ]; then
  OZONE=(--ozone-platform=wayland --enable-features=UseOzonePlatform)
fi

# Nur für gezielte Fehlersuche per Chrome DevTools Protocol — bewusst kein
# Dauerzustand: RUBICON_DEBUG=1 vor dem Aufruf setzen.
DEBUG=()
if [ "${RUBICON_DEBUG:-}" = "1" ]; then
  DEBUG=(--remote-debugging-port=9222 --remote-allow-origins=*)
fi

# Neustart-Schleife: Das Panel läuft unbeaufsichtigt. Stürzt Chromium ab oder
# beendet ihn der Speichermanager, kommt er von selbst zurück — sonst bliebe
# der Bildschirm bis zum nächsten Handanlegen leer. Die Wartezeit verdoppelt
# sich bei wiederholtem Sofortabsturz, damit eine kaputte Installation nicht
# dauerhaft einen Kern belegt.
wartezeit=3

echo "Kiosk startet auf $URL" >&2

while true; do
  warte_auf_server
  saeubere_profil
  beginn=$SECONDS

  "$BROWSER" \
    "${OZONE[@]}" \
    "${DEBUG[@]}" \
    `# Kein Systemschlüsselbund: Bei automatischer Anmeldung bleibt der` \
    `# GNOME-Keyring gesperrt. Chromium fragt danach mit einem modalen` \
    `# Fenster, das den Browser blockiert — die Seite bleibt weiß. Genau` \
    `# daran lag es auf diesem Pi über Stunden.` \
    --password-store=basic \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    `# Übersetzungsleiste: verdeckt sonst die Statusanzeige. --lang verhindert,` \
    `# dass Chromium die deutsche Seite überhaupt als fremdsprachig ansieht.` \
    --disable-features=Translate,TranslateUI,TranslateSubFrames \
    --lang=de-DE \
    --no-first-run \
    --check-for-update-interval=31536000 \
    --overscroll-history-navigation=0 \
    --disable-pinch \
    `# Mikrofon ohne Nachfrage freigeben — im Kiosk kann niemand zustimmen.` \
    --use-fake-ui-for-media-stream \
    `# Der Timer-Klingelton soll auch ohne vorherige Berührung laufen.` \
    --autoplay-policy=no-user-gesture-required \
    "$URL" || true

  # Lief er lange genug, war es ein echter Absturz und kein Startfehler.
  if [ $((SECONDS - beginn)) -ge 30 ]; then
    wartezeit=3
  else
    wartezeit=$((wartezeit < 60 ? wartezeit * 2 : 60))
  fi

  echo "Chromium beendet — Neustart in ${wartezeit}s" >&2
  sleep "$wartezeit"
done
