# Auf dem Raspberry Pi einrichten

Ergebnis am Ende: Der Pi startet, das Dashboard erscheint im Vollbild, ohne
Tastatur, ohne Mausklick — und kommt nach einem Stromausfall von allein zurück.

Rechne mit **45 bis 60 Minuten**, davon die Hälfte Wartezeit beim Installieren.

> **Dieser Pi ist bereits eingerichtet** (Stand 5. September 2026).
> Hostname `cindralux`, Raspberry Pi 4 Model B Rev 1.5, Debian 13 (trixie),
> Compositor labwc, Display 1920×1200.
> Der Rest dieser Anleitung beschreibt, wie es dorthin kam — und wie du es
> auf einem zweiten Gerät wiederholst. Was auf diesem Pi konkret gewählt
> wurde, steht jeweils als *Auf diesem Pi:* am Abschnittsende.

---

## Was du brauchst

| | Empfehlung | Anmerkung |
| --- | --- | --- |
| Modell | **Pi 4 (2 GB+) oder Pi 5** | Ein Pi 3 schafft es, ruckelt aber sichtbar — dort „Animationen reduzieren" einschalten. Pi Zero reicht nicht. |
| System | **Raspberry Pi OS (64-bit), Bookworm oder neuer, mit Desktop** | „Lite" geht nicht — für den Kiosk wird eine Desktop-Sitzung gebraucht. |
| Speicher | 8 GB Karte reicht, 16 GB ist bequemer | `node_modules` belegt rund 200 MB. |
| Display | beliebig, Querformat | Getestet für 1024×600, 1280×800 und 1920×1080. |

Prüfe zuerst, dass du wirklich 64-bit fährst — davon hängt ab, welche
Programmdateien npm herunterlädt:

```bash
uname -m        # muss aarch64 sein, nicht armv7l
```

---

## 1. Node installieren

Die App braucht **Node 20 oder neuer**. Welcher Weg richtig ist, hängt von
der Debian-Fassung ab — erst nachsehen, was deine Paketquelle anbietet:

```bash
apt-cache policy nodejs | head -3
```

**Debian 13 (trixie) und neuer** liefern Node 20.19 direkt mit. Das genügt,
und Sicherheitsupdates kommen dann über die normale Systemaktualisierung:

```bash
sudo apt install -y nodejs npm git
```

**Bookworm** liefert nur Node 18. Dort brauchst du NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
```

**Ohne Root-Rechte** (kein sudo-Passwort zur Hand) geht auch eine
Installation im Benutzerverzeichnis:

```bash
VER=$(curl -fsSL https://nodejs.org/dist/index.json \
      | grep -o '"version":"v22[^"]*"' | head -1 | cut -d'"' -f4)
curl -fsSLo /tmp/node.tar.xz \
  "https://nodejs.org/dist/$VER/node-$VER-linux-arm64.tar.xz"
mkdir -p ~/.local/node
tar -xJf /tmp/node.tar.xz -C ~/.local/node --strip-components=1
echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.profile
```

> Der Haken daran: Diese Node-Installation bekommt **keine automatischen
> Sicherheitsupdates**. Du musst sie von Hand erneuern. Wenn du an ein
> sudo-Passwort kommst, ist der `apt`-Weg der bessere.

*Auf diesem Pi:* Node 22.23.2 im Benutzerverzeichnis (`~/.local/node`),
weil kein sudo-Passwort verfügbar war. Umstellen auf die System-Fassung
später: `sudo apt install -y nodejs npm`, dann die PATH-Zeile aus
`~/.profile` entfernen.

---

## 2. Projekt auf den Pi bringen

> **Wichtig: `node_modules` NICHT mitkopieren.** Darin stecken Programmdateien
> für x86-Prozessoren (`@esbuild/linux-x64`, `@rollup/rollup-linux-x64-gnu`).
> Auf dem Pi müssen die ARM-Varianten geladen werden — deshalb wird dort neu
> installiert.

Per Git (falls du das Projekt in ein Repository gelegt hast):

```bash
git clone <dein-repo> ~/cindralux
cd ~/cindralux
```

Oder direkt vom Rechner aus kopieren:

```bash
rsync -av --delete \
  --exclude node_modules --exclude dist --exclude .git \
  --exclude 'data/' \
  ~/Projekte/Rubicon/pi-dashboard/ pi@cindralux.local:~/cindralux/
```

Das gesamte Verzeichnis `data/` ist bewusst ausgenommen, damit Konfiguration,
Listen und Fotos auf dem Pi erhalten bleiben — siehe Schritt 4.

Der Kiosk läuft unter `http://127.0.0.1:4000`. Verwaltung vom Rechner aus
erfolgt über einen SSH-Tunnel oder einen HTTPS-Proxy: **[Zugriff und Betrieb](security.md)**.

---

## 3. Installieren und bauen

```bash
cd ~/cindralux
npm install
npm run build
```

Auf einem Pi 4 dauert der Build ein bis zwei Minuten. Bei einem Pi mit nur
1 GB RAM vorher Swap vergrößern, sonst bricht der Build ab:

```bash
sudo dphys-swapfile swapoff
sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
sudo dphys-swapfile setup && sudo dphys-swapfile swapon
```

Kurz von Hand testen:

```bash
npm start
# in einem zweiten Fenster:
curl -s localhost:4000/api/health
```

---

## 4. Konfiguration und Geheimnisse

`data/config.json` enthält die **private ICS-Adresse deines Kalenders**, den
Home-Assistant-Token und den API-Key. Diese Datei gehört nicht ins Git und
nicht in ein Backup, das andere sehen.

Zwei Wege:

**a) Datei einzeln und verschlüsselt kopieren**

```bash
scp ~/Projekte/Organisator/data/config.json pi@raspberrypi.local:~/cindralux/data/
chmod 600 ~/cindralux/data/config.json     # auf dem Pi
```

**b) Auf dem Pi neu eintragen** — Dashboard öffnen, Zahnrad, Adressen einfügen.
Die Datei wird beim ersten Start mit Standardwerten angelegt.

Alternativ können die Geheimnisse als Umgebungsvariablen in
`~/cindralux/.env` stehen (`HA_TOKEN`, `AI_API_KEY`, …) und über die
`EnvironmentFile`-Zeile der Unit geladen werden. Dann bleibt `config.json`
frei von Zugangsdaten.

---

## 5. Als Dienst einrichten

```bash
sudo cp ~/cindralux/deploy/cindralux-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cindralux-dashboard
systemctl status cindralux-dashboard
```

Der Dienst startet beim Hochfahren, wartet aufs Netz und startet sich bei
einem Absturz neu. Logs:

```bash
journalctl -u cindralux-dashboard -f
```

Läuft dein Benutzer nicht `pi` oder liegt das Projekt woanders, passe in der
Unit `User=`, `Group=`, `WorkingDirectory=` und `ReadWritePaths=` an.

### Ohne Root-Rechte: Benutzer-Dienst

Kommst du an kein sudo-Passwort, geht es auch als **Benutzer-Dienst**. Der
braucht keine Root-Rechte, startet aber erst mit der Anmeldung — bei
aktivierter automatischer Anmeldung ist das dasselbe wie beim Hochfahren:

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/cindralux-dashboard.service <<'UNIT'
[Unit]
Description=Cindralux Home Command Center
# Kein After=network-online.target: Dieses Target gibt es im Benutzerkontext
# nicht, die Zeile bliebe wirkungslos. Nötig ist sie auch nicht — das
# Dashboard startet ohne Netz und zeigt zwischengespeicherte Termine.

[Service]
Type=simple
UMask=0077
WorkingDirectory=%h/cindralux
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=4000
Environment=PATH=%h/.local/node/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=%h/.local/node/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now cindralux-dashboard
```

Logs dann mit `journalctl --user -u cindralux-dashboard -f`.

Prüfe, dass die automatische Anmeldung wirklich eingerichtet ist — sonst
startet nichts:

```bash
grep -E '^autologin-(user|session)' /etc/lightdm/lightdm.conf
```

Fehlt sie, ist entweder `raspi-config` der Weg (Schritt 6) oder du
aktivierst Lingering, damit der Dienst ohne Anmeldung läuft — das braucht
allerdings wieder Root: `sudo loginctl enable-linger $USER`.

*Auf diesem Pi:* Benutzer-Dienst, weil kein sudo-Passwort verfügbar war.
Automatische Anmeldung ist aktiv (`autologin-user=pi`,
`autologin-session=rpd-labwc`), Lingering deshalb nicht nötig.

---

## 6. Kiosk einrichten

**Automatisch anmelden**, damit nach dem Strom eine Desktop-Sitzung startet:

```bash
sudo raspi-config
# System Options → Boot / Auto Login → Desktop Autologin
```

**Bildschirmschoner aus** — sonst wird das Panel schwarz:

```bash
sudo raspi-config
# Display Options → Screen Blanking → No
```

**Kiosk starten lassen.** Der XDG-Autostart funktioniert unter Wayland
(Standard auf Bookworm) wie unter X11:

```bash
mkdir -p ~/.config/autostart
cp ~/cindralux/deploy/cindralux-kiosk.desktop ~/.config/autostart/
```

Falls dein Pfad nicht `/home/pi/cindralux` ist, die `Exec=`-Zeile anpassen.

Greift der Autostart nicht, hängt es an der Sitzungsart:

| Sitzung | Datei | Zeile |
| --- | --- | --- |
| labwc (Pi 5, neuere Bookworm) | `~/.config/labwc/autostart` | `/home/pi/cindralux/deploy/cindralux-kiosk.sh &` |
| wayfire (Pi 4, Bookworm) | `~/.config/wayfire.ini`, Abschnitt `[autostart]` | `cindralux = /home/pi/cindralux/deploy/cindralux-kiosk.sh` |
| X11 / LXDE | `~/.config/lxsession/LXDE-pi/autostart` | `@/home/pi/cindralux/deploy/cindralux-kiosk.sh` |

Welche läuft, verrät `echo $XDG_SESSION_TYPE` (`wayland` oder `x11`).

> **Wayland-Falle:** Chromium sucht ohne Zutun einen X-Server und beendet
> sich mit „Missing X server or `$DISPLAY`". Das Startskript setzt deshalb
> `--ozone-platform=wayland`, sobald `WAYLAND_DISPLAY` gesetzt ist — du
> musst nichts tun, aber wenn du den Aufruf selbst baust, fehlt genau das
> gern.

*Auf diesem Pi:* labwc, Autostart liegt in `~/.config/labwc/autostart`.

Neu starten — das Dashboard sollte im Vollbild erscheinen:

```bash
sudo reboot
```

---

## 7. Touchscreen einrichten

### Erst herausfinden, was du überhaupt hast

Sitzungsart, Display und Touch-Gerät musst du nicht raten — auf dem Pi:

```bash
bash ~/cindralux/deploy/cindralux-check.sh
```

Das Skript liest nur aus und ändert nichts. Es nennt Modell, Architektur,
Compositor samt der **für dich richtigen Autostart-Datei**, die erkannte
Auflösung, das Touch-Gerät und ob der Dienst läuft. Die Ausgabe enthält
keine Zugangsdaten und kann weitergegeben werden.

### Zuerst der wichtigste Rat: richte alles vom Rechner aus ein

Getippt wird fast nur einmal — Kalenderadressen, Orte, Schlüssel. Das ist
auf einem Touchpanel mühsam. Öffne die Einstellungen stattdessen vom
Laptop über einen SSH-Tunnel:

```bash
ssh -N -L 4000:127.0.0.1:4000 pi@cindralux.local
```

Öffne dann `http://127.0.0.1:4000`. Für Zugriff vom Handy einen
HTTPS-Proxy mit Anmeldung einrichten, siehe [Zugriff und Betrieb](security.md).

Alles, was du dort einträgst, landet in `data/config.json` auf dem Pi und
erscheint sofort auf dem Panel — der Server liest die Datei im laufenden
Betrieb neu ein. Danach brauchst du auf dem Touchscreen nur noch zu tippen
und zu wischen.

> Der Sprachmodus ist die Ausnahme: Mikrofone geben Browser nur über
> `localhost` frei. Sprache funktioniert also nur direkt auf dem Pi, nicht
> über die Netzwerkadresse.

### Bildschirmtastatur

**Die App bringt eine eigene mit.** Sobald du ein Eingabefeld antippst,
fährt unten eine QWERTZ-Tastatur mit Umlauten hoch. Sie legt sich nie über
den Inhalt: Der Bereich darüber wird um genau ihre Höhe kleiner, gemessen
zur Laufzeit statt geschätzt.

Gesteuert wird das unter *Einstellungen → Darstellung → Bildschirmtastatur*:

| Modus | Verhalten |
| --- | --- |
| **Automatisch** (Vorgabe) | Nur wenn das System keine echte Tastatur meldet |
| **Immer** | Auch bei angeschlossener Tastatur |
| **Aus** | Nie |

Die Erkennung läuft über den Server (`/api/system/input`), weil ein Browser
angeschlossene Tastaturen nicht sehen kann — er merkt nur, wenn jemand
tippt. Der Server zählt die `*-event-kbd`-Einträge unter
`/dev/input/by-path`. Steckst du eine Tastatur ein, verschwindet die
Bildschirmtastatur beim nächsten Abruf, spätestens nach einer Minute.

Eine Systemtastatur (`onboard`, `squeekboard`, `wvkbd`) brauchst du dafür
nicht — und sie wäre hier auch die schlechtere Wahl, weil sie sich als
eigenes Fenster über das Dashboard legen würde.

*Auf diesem Pi:* Automatisch. Das System meldet keine Tastatur und einen
Touchscreen (`wch.cn TouchScreen`), die Tastatur ist also aktiv.

### Mauszeiger ausblenden

Im Kiosk steht sonst ein Pfeil mitten im Bild. Unter X11:

```bash
sudo apt install -y unclutter-xfixes
```

Und im Autostart ergänzen:

```bash
unclutter --timeout 0 &
```

Unter Wayland blenden die meisten Compositoren den Zeiger bei Berührung
von selbst aus.

### Drehung und Kalibrierung

Hängt das Panel hochkant oder verkehrt herum, stelle die Drehung ein:

| Sitzung | Wo |
| --- | --- |
| Wayland | Menü → *Einstellungen → Screen Configuration* |
| X11 | `raspi-config` → *Display Options* → *Rotation* |

Unter Wayland dreht sich die Toucheingabe automatisch mit. **Unter X11
nicht** — dort zeigt der Finger nach dem Drehen an die falsche Stelle und
du musst die Eingabe separat zuordnen:

```bash
xinput list                       # Namen des Touch-Geräts finden
# 90° im Uhrzeigersinn:
xinput set-prop "<Gerätename>" "Coordinate Transformation Matrix" 0 1 0 -1 0 1 0 0 1
```

Offizielle Raspberry-Pi-Displays brauchen keine Kalibrierung. Billige
HDMI-Panels mit USB-Touch manchmal schon — dann hilft `xinput_calibrator`.

### Was die App schon selbst erledigt

Darum musst du dich **nicht** kümmern:

- **Zoom-Gesten gesperrt** — kein versehentliches Auseinanderziehen
- **Kein Kontextmenü bei langem Tippen** — außer in Eingabefeldern, wo
  Einfügen praktisch ist
- **Kein Textmarkieren** beim Wischen
- **Kein Scrollen des Gesamtbildes** — nur Listen scrollen innerhalb ihrer
  Felder

---

## 8. Mikrofon (nur für den Sprachmodus)

Der Sprachmodus und ChatGPT Live brauchen ein Mikrofon. Prüfen:

```bash
pactl list cards | grep -A1 "Active Profile"
```

Steht dort **`pro-audio`**, liefert der Eingang kein Signal — dieses Profil
stellt nur rohe Kanäle ohne Portauswahl bereit. Umstellen:

```bash
pactl set-card-profile <kartenname> output:analog-stereo+input:analog-stereo
pactl set-default-source <quellenname>
pactl set-source-volume <quellenname> 100%
```

Testen — RMS muss deutlich über null liegen:

```bash
timeout 4 pw-record test.wav && python3 - <<'PY'
import wave, struct, math
with wave.open("test.wav") as w:
    raw = w.readframes(w.getnframes()); sw = w.getsampwidth()
v = struct.unpack(f"<{len(raw)//sw}{'h' if sw==2 else 'i'}", raw[:(len(raw)//sw)*sw])
full = 2**(8*sw-1)
print("RMS:", math.sqrt(sum((x/full)**2 for x in v)/len(v)))
PY
```

Der Kiosk-Starter übergibt `--use-fake-ui-for-media-stream`, damit Chromium
nicht nach der Erlaubnis fragt — im Vollbild könnte sie niemand erteilen.

> **Mikrofon nur über localhost.** Browser geben `getUserMedia` nur in
> sicherem Kontext frei. `http://localhost:4000` gilt als sicher, eine
> LAN-Adresse wie `http://192.168.1.50:4000` **nicht**. Vom Handy aus geht der
> Sprachmodus deshalb nur mit HTTPS.

---

## 9. Bildschirm nachts abschalten

Die Nachtabsenkung im Dashboard dunkelt **das Bild** ab — die
Hintergrundbeleuchtung kann ein Browser nicht steuern. Für echtes Abschalten:

```bash
# Wayland
wlopm --off '*'      # aus
wlopm --on '*'       # an

# X11
xset dpms force off
```

Per `crontab -e` zeitgesteuert, zum Beispiel 23 Uhr aus, 6 Uhr an:

```cron
0 23 * * * DISPLAY=:0 wlopm --off '*'
0 6  * * * DISPLAY=:0 wlopm --on '*'
```

Ein offizielles Pi-Display lässt sich auch direkt dimmen:

```bash
echo 30 | sudo tee /sys/class/backlight/*/brightness
```

---

## 10. Aktualisieren

```bash
cd ~/cindralux
git pull                      # oder erneut rsync (ohne data/config.json!)
npm install
npm run build
sudo systemctl restart cindralux-dashboard
# Beim Benutzerdienst stattdessen:
# systemctl --user restart cindralux-dashboard
```

Das Dashboard im Browser lädt sich nicht von allein neu — Bildschirm berühren
und `F5`, oder den Kiosk neu starten:

```bash
pkill chromium; ~/cindralux/deploy/cindralux-kiosk.sh &
```

---

## Wenn etwas klemmt

### Weißer Bildschirm, obwohl der Server antwortet

Bei **automatischer Anmeldung bleibt der GNOME-Schlüsselbund gesperrt** — es
gibt ja kein Anmeldepasswort. Chromium fragt beim Start danach und zeigt
dafür ein Fenster, das den ganzen Browser blockiert. Die Seite wird nie
gezeichnet: weißer Bildschirm. Verräterisch ist, dass `curl` auf dem Pi
sauber HTTP 200 liefert und selbst `example.com` weiß bleibt.

Das Startskript umgeht das mit `--password-store=basic`. Ist der Dialog
trotzdem zu sehen, hilft `Cancel` — er kommt beim nächsten Start nicht
wieder. Firefox fragt nicht nach dem Schlüsselbund und ist deshalb von
diesem Fehler nie betroffen.


Zuerst immer:

```bash
bash ~/cindralux/deploy/cindralux-check.sh
journalctl -u cindralux-dashboard -n 50 --no-pager
```

| Beobachtung | Ursache |
| --- | --- |
| Weiße Seite oder „Verbindung fehlgeschlagen" | Dienst läuft nicht — `journalctl -u cindralux-dashboard -n 50` |
| `npm install` bricht mit „Killed" ab | Zu wenig RAM, Swap vergrößern (Schritt 3) |
| Beim Start blockiert npm ein Installationsskript | Der Block `allowScripts` in der `package.json` gibt esbuild frei; er muss mitkopiert werden |
| Kiosk startet nicht | Falsche Sitzungsart, siehe Tabelle in Schritt 6 |
| Bild wird nach Minuten schwarz | Bildschirmschoner noch an (Schritt 6) |
| Mikrofon ohne Pegel | `pro-audio`-Profil aktiv (Schritt 7) |
| Alles ruckelt | Pi 3, oder Einstellungen → Darstellung → „Animationen reduzieren" |
| Nach Update alte Ansicht | Browser zeigt zwischengespeicherte Seite — Kiosk neu starten |

---

## Was bewusst NICHT eingerichtet wird

- **Kein Docker.** Ein Node-Prozess und eine systemd-Unit sind auf einem Pi
  weniger beweglich als ein Container-Stack.
- **Kein Reverse-Proxy im Standard-Setup.** Das Dashboard hört auf
  `127.0.0.1:4000`. Zugriff vom Rechner erfolgt über einen SSH-Tunnel;
  Netzwerkzugriff benötigt einen lokalen HTTPS-Proxy und Anmeldung, siehe
  [Zugriff und Betrieb](security.md).
- **Kein automatisches Update.** Ein Panel, das sich nachts selbst umbaut und
  danach nicht mehr startet, ist schlimmer als eines auf altem Stand.

---

## Hostname setzen

Für einen sauberen Namen im Heimnetz (`cindralux.local` statt der IP):

```bash
sudo hostnamectl set-hostname cindralux
sudo systemctl restart avahi-daemon
```

Danach ist der Pi unter `cindralux.local` erreichbar — inklusive SSH
(`ssh pi@cindralux.local`). Kollidiert der Name mit einem anderen Gerät im
selben Netz, hängt Avahi automatisch eine Zahl an (`cindralux-2.local`).
weiter wie gewohnt, es ist nur noch der alte Name für ein neu benanntes Projekt.
