# Google Fotos in die Diashow einbinden

Das Dashboard zeigt im Ruhemodus optional eine Bilder-Diashow. Lokale Bilder
funktionieren ohne jede Einrichtung; Google Fotos kommen über die **Photos
Picker API** dazu — der einzige Weg, den Google seit 2025 noch anbietet.
Google hat den automatischen Zugriff auf die ganze Mediathek abgeschafft: du
wählst Bilder jedes Mal bewusst in Googles eigenem Fenster aus, es gibt keinen
Hintergrund-Sync eines Albums.

Die Verbindung ist **dieselbe wie beim Google-Kalender** — ein Google-Konto,
ein OAuth-Client. Hast du den Kalender schon eingerichtet
([docs/google-kalender.md](google-kalender.md)), fehlt nur noch **Schritt 1**
unten (API aktivieren) und ein einmaliges **Trennen + neu Verbinden**, damit
das Refresh-Token den zusätzlichen Bereich bekommt.

---

## 1. Photos Picker API aktivieren

1. [console.cloud.google.com](https://console.cloud.google.com) öffnen, dasselbe
   Projekt wie beim Kalender auswählen (oder ein neues anlegen — siehe
   [docs/google-kalender.md](google-kalender.md), Schritt 1).
2. Im Suchfeld oben `Google Photos Picker API` eingeben und den Treffer öffnen.
3. Auf **Aktivieren**.

Mehr ist in der Cloud Console nicht nötig — Zustimmungsbildschirm und
OAuth-Client sind bereits eingerichtet, sofern der Kalender schon läuft.

Ganz ohne Kalender-Setup: Schritte 1–4 aus
[docs/google-kalender.md](google-kalender.md) einmal durchgehen (Projekt,
Zustimmungsbildschirm, OAuth-Client), diesen Schritt hier zusätzlich, dann
weiter unten fortfahren.

## 2. Verbinden (oder neu verbinden)

1. Dashboard öffnen → Zahnrad → **Darstellung → Fotos**.
2. War schon eine Google-Verbindung aktiv (nur für den Kalender eingerichtet):
   unter **Kalender → Google Kalender** auf **Trennen**, danach erneut **Mit
   Google verbinden**. Ohne diesen Schritt fehlt dem alten Token der neue
   Berechtigungsbereich, und der Import schlägt mit einer
   Berechtigungsmeldung fehl.
3. Neu verbinden: Konto wählen, bei der Warnung „Google hat diese App nicht
   überprüft" auf **Erweitert → Weiter zu Cindralux Dashboard**, danach sowohl
   den Kalender- als auch den Fotos-Zugriff bestätigen.

## 3. Bilder auswählen

1. Im Abschnitt **Fotos** auf **Google Fotos auswählen** tippen.
2. Es öffnet sich Googles Auswahlfenster. Bilder markieren, dann bestätigen.
3. Das Dashboard fragt im Hintergrund nach, bis die Auswahl steht, lädt die
   gewählten Bilder herunter und legt sie als eigene Dateien in den
   konfigurierten Bilderordner. Ab dann laufen sie wie lokale Bilder mit —
   inklusive der Kachel-Auswahl, welche die Diashow zeigen soll.

Ein erneuter Tipp auf **Google Fotos auswählen** startet eine neue Sitzung und
ergänzt die Auswahl; bereits heruntergeladene Bilder bleiben erhalten, bis sie
manuell aus dem Ordner entfernt werden.

---

## Wenn etwas klemmt

| Meldung | Ursache |
| --- | --- |
| **PERMISSION_DENIED** / Hinweis auf fehlenden Bereich | Verbindung stammt noch von vor der Fotos-Anbindung — einmal trennen und neu verbinden (Schritt 2). |
| **API not enabled** o. ä. | Schritt 1 (Photos Picker API aktivieren) übersprungen oder falsches Projekt ausgewählt. |
| Fenster bleibt leer / Popup blockiert | Popups für die Dashboard-Seite erlauben. |
| Zeitüberschreitung nach dem Auswählen | Im Google-Fenster wurde die Auswahl nicht mit dem Bestätigen-Knopf abgeschlossen. |

## Was gespeichert wird und wo

Es gibt kein eigenes Geheimnis für Fotos — dieselben Client-ID, Client-Secret
und Refresh-Token wie beim Kalender liegen lokal in `data/config.json`
(gitignored) und verlassen den Server nie.

Heruntergeladene Bilder landen als normale Dateien im konfigurierten
Bilderordner (Standard `data/photos/`). Eine kleine Datei
`.photos-meta.json` im selben Ordner merkt sich pro Bild Herkunft, Aufnahmedatum
und optional eine Personen-Zuordnung, damit Google-Bilder in der
Einstellungsansicht entsprechend markiert werden — sie enthält keine
Zugangsdaten und lässt sich gefahrlos löschen (die Bilder gelten danach
einfach als lokal, ohne Aufnahmedatum/Personen-Tag).

Der angeforderte Bereich ist `photospicker.mediaitems.readonly` — eingeschränkt
auf genau die Bilder, die im Picker-Fenster ausdrücklich ausgewählt werden.
Auf die restliche Google-Fotos-Mediathek hat das Dashboard keinen Zugriff.
