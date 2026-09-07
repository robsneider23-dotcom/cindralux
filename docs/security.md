# Zugriff und Betrieb

Der Server lauscht standardmäßig auf `127.0.0.1:4000`. Der Kiosk öffnet diese
Adresse direkt. Ein ungeschützter Zugriff über die LAN-Adresse wird abgewiesen.

Für die Verwaltung vom eigenen Rechner einen SSH-Tunnel öffnen:

```bash
ssh -N -L 4000:127.0.0.1:4000 pi@cindralux.local
```

Danach im Browser `http://127.0.0.1:4000` öffnen. Auf dem eigenen Rechner muss
Port 4000 frei sein; alternativ links beispielsweise 4400 verwenden und im
Browser `http://127.0.0.1:4400` öffnen.

## Optionaler HTTPS-Zugriff

Für Netzwerkzugriff benötigt der Server beide Umgebungsvariablen:

- `DASHBOARD_PASSWORD`: mindestens 20 Zeichen; Benutzername ist `cindralux`.
- `DASHBOARD_ORIGIN`: vollständige HTTPS-Origin ohne Pfad, etwa
  `https://display.example`.

Ein auf demselben Gerät laufender TLS-Proxy muss Anfragen an
`127.0.0.1:4000` weiterreichen, den Host der konfigurierten Origin erhalten und
`X-Forwarded-Proto` selbst auf `https` setzen. Der Browser benötigt ein gültiges,
vertrauenswürdiges Zertifikat. Das Passwort gilt dann auch für den lokalen Kiosk.
Umgebungsdateien mit Zugangsdaten mit Dateimodus `600` schützen und nicht ins
Repository aufnehmen.

## Daten und Integrationen

Das Verzeichnis `data/` enthält Konfiguration, Zugangsdaten, Listen und Fotos.
Bei Updates vollständig erhalten und vorab sichern. JSON-Dateien werden mit
privaten Dateirechten gespeichert. Backups genauso vertraulich behandeln.

Externe HTTP-Abrufe haben Größen- und Zeitlimits. Private Netzwerkziele sind
für allgemeine Abrufe gesperrt; ausdrücklich konfigurierte Home-Assistant-
Verbindungen dürfen ins lokale Netz. Für einen eigenen internen Feedserver
kann `DASHBOARD_FETCH_HOSTS` gezielt dessen Hostnamen freigeben (mehrere durch
Komma getrennt). Metadaten- und Link-local-Adressen bleiben gesperrt.

Eigene API-Clients müssen zusätzlich `X-Cindralux-Request: 1` senden und für
schreibende Anfragen `Content-Type: application/json` verwenden. Ausgenommen
sind passive Health- und Fotodateiabrufe sowie der OAuth-Callback mit State-Prüfung.

## Überprüfung

```bash
npm run typecheck
npm run test:security
npm run build
bash deploy/cindralux-check.sh
```

Die systemweite Unit setzt `NoNewPrivileges=true`; dadurch kann der Server
keine Rechte über sudo erhalten. Neustart und Herunterfahren über die
Dashboard-Schaltflächen benötigen einen entsprechend eingerichteten
Benutzerdienst und die eng begrenzte Regel aus `deploy/cindralux-power.sudoers`.
