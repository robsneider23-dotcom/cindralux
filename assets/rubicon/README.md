# Rubicon-Assets

Alle Dateien hier sind **Platzhalter** und lassen sich 1:1 durch echte
Rubicon-Assets ersetzen — Dateinamen beibehalten, dann ändert sich im Code nichts.

| Datei | Verwendung | Empfohlenes Format |
| --- | --- | --- |
| `logo-mark.svg` | Emblem oben links in der Statusleiste | SVG, quadratisch, 64×64 |
| `watermark.svg` | Großes, sehr dezentes Wasserzeichen im Hintergrund | SVG, quadratisch, einfarbig |
| `favicon.svg` | Browser-Tab / Kiosk-Icon | SVG, quadratisch |
| `backdrop-topo.svg` | Hintergrund „Topografie" | SVG oder JPG, 1920×1080 |
| `backdrop-waves.svg` | Hintergrund „Wellen" | SVG oder JPG, 1920×1080 |
| `backdrop-grid.svg` | Hintergrund „Raster" | SVG oder JPG, 1920×1080 |

## Eigenen Hintergrund hinzufügen

1. Datei in diesen Ordner legen, z. B. `backdrop-eigenes.jpg`.
2. In `client/src/theme/tokens.js` unter `backgrounds` einen Eintrag ergänzen:
   `{ file: 'backdrop-eigenes.jpg', label: 'Eigenes' }`
3. Der neue Hintergrund erscheint automatisch in den Einstellungen unter *Darstellung*.

Die Dateien werden sowohl im Dev-Server (Vite `publicDir`) als auch vom Express-Server
unter `/rubicon/<datei>` ausgeliefert.
