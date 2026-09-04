# Google Kalender anbinden

Das Dashboard kann Google-Kalender auf zwei Wegen lesen. Dieser Text beschreibt
den **API-Weg** — der andere (private iCal-Adresse) braucht kein Google-Projekt,
hat dafür aber bis zu 24 Stunden Verzögerung.

| | iCal-Adresse | API (diese Anleitung) |
| --- | --- | --- |
| Einrichtung | Adresse kopieren, fertig | einmalig ein Google-Cloud-Projekt |
| Aktualität | bis zu 24 Stunden Verzug | nahezu live |
| Kalenderauswahl | jeder Kalender einzeln | alle Kalender des Kontos auf einen Blick |
| Serientermine | vom Dashboard aufgelöst | von Google aufgelöst |

Der Aufwand unten sind etwa zehn Minuten Klickarbeit. Danach ist nichts mehr zu
tun — das Refresh-Token bleibt gültig, bis du den Zugriff selbst entziehst.

---

## 1. Projekt anlegen

1. [console.cloud.google.com](https://console.cloud.google.com) öffnen und mit
   dem Google-Konto anmelden, dessen Kalender du sehen willst.
2. Oben in der Projektauswahl auf **Neues Projekt**.
3. Name z. B. `Rubicon Dashboard`, dann **Erstellen**.
4. Warten, bis das Projekt oben ausgewählt ist.

## 2. Calendar-API aktivieren

1. Im Suchfeld oben `Google Calendar API` eingeben und den Treffer öffnen.
2. Auf **Aktivieren**.

## 3. Zustimmungsbildschirm einrichten

Google verlangt das, bevor es einen OAuth-Client ausgibt.

1. Links **APIs & Dienste → OAuth-Zustimmungsbildschirm**.
2. Nutzertyp **Extern** wählen, **Erstellen**.
   *(„Intern" gibt es nur mit Google Workspace.)*
3. Ausfüllen:
   - **App-Name**: `Rubicon Dashboard`
   - **E-Mail-Adresse für Nutzersupport**: deine Adresse
   - **Kontaktdaten des Entwicklers**: dieselbe Adresse
4. **Speichern und fortfahren**.
5. Bei **Bereiche** nichts hinzufügen, einfach weiter.
6. Bei **Testnutzer** auf **Add users** und **deine eigene Google-Adresse**
   eintragen. Das ist wichtig — ohne diesen Eintrag lehnt Google die Anmeldung
   später mit „Zugriff blockiert" ab.
7. **Speichern und fortfahren**, dann **Zurück zum Dashboard**.

> Die App bleibt im Status „Testing". Das genügt vollkommen: Ein Refresh-Token
> aus einer Test-App läuft nach sieben Tagen ab. Wenn dich das stört, drückst du
> im Zustimmungsbildschirm einmal auf **App veröffentlichen** — eine
> Google-Überprüfung ist nicht nötig, solange nur du selbst sie benutzt.

## 4. OAuth-Client erstellen

1. Links **APIs & Dienste → Anmeldedaten**.
2. Oben **+ Anmeldedaten erstellen → OAuth-Client-ID**.
3. Anwendungstyp: **Webanwendung**.
   *(Nicht „Desktop" — wir brauchen eine feste Weiterleitungsadresse.)*
4. Name z. B. `Rubicon lokal`.
5. Unter **Autorisierte Weiterleitungs-URIs** auf **+ URI hinzufügen** und
   genau das eintragen:

   ```
   http://127.0.0.1:4000/api/google/callback
   ```

   Läuft dein Server auf einem anderen Port, entsprechend anpassen. Die
   Adresse steht auch im Dashboard direkt über dem Verbinden-Knopf.
6. **Erstellen**. Google zeigt jetzt **Client-ID** und **Client-Schlüssel** —
   beide brauchst du gleich.

## 5. Im Dashboard eintragen

1. Dashboard öffnen → Zahnrad → **Kalender**.
2. Ganz oben im Abschnitt **Google Kalender**:
   - **Client-ID** einfügen
   - **Client-Secret** einfügen
3. Oben rechts **Speichern**.
4. Auf **Mit Google verbinden**. Es öffnet sich ein Fenster mit dem
   Google-Login.
5. Konto wählen, bei der Warnung „Google hat diese App nicht überprüft" auf
   **Erweitert → Weiter zu Rubicon Dashboard** und dann den Kalenderzugriff
   bestätigen.
6. Das Fenster meldet „Google verbunden" und kann geschlossen werden.

## 6. Kalender auswählen

Nach dem Verbinden erscheint im selben Abschnitt die Liste aller Kalender des
Kontos. Ein Tipp auf einen Eintrag nimmt ihn ins Dashboard auf, ein weiterer
Tipp entfernt ihn wieder. Die Farbe übernimmt das Dashboard von Google; sie
lässt sich unten bei den Kalenderquellen ändern.

Anschließend oben rechts **Speichern**.

---

## Wenn etwas klemmt

| Meldung | Ursache |
| --- | --- |
| **Zugriff blockiert: … hat die Google-Überprüfung nicht abgeschlossen** | Deine Adresse fehlt bei den **Testnutzern** (Schritt 3.6). |
| **redirect_uri_mismatch** | Die Weiterleitungs-URI in Google stimmt nicht exakt mit der im Dashboard angezeigten überein — auf `127.0.0.1` statt `localhost` und auf den Port achten. |
| **Google hat kein refresh_token geliefert** | Der Zugriff wurde schon einmal erteilt. Unter [myaccount.google.com/permissions](https://myaccount.google.com/permissions) entziehen und neu verbinden. |
| **invalid_client** | Client-ID oder Secret vertippt, oder das Secret gehört zu einem anderen Client. |
| Nach sieben Tagen keine Termine mehr | Test-App: Refresh-Token abgelaufen. Entweder neu verbinden oder die App veröffentlichen (Schritt 3, Hinweiskasten). |

## Was gespeichert wird und wo

Client-ID, Client-Secret und Refresh-Token liegen ausschließlich lokal in
`data/config.json` auf deinem Gerät. Die Datei ist gitignored. An den Client
liefert der Server die Geheimnisse nie aus — dort steht nur, *ob* etwas
hinterlegt ist.

Der angeforderte Bereich ist `calendar.readonly`: Das Dashboard kann Termine
**nur lesen**, nicht anlegen oder ändern.

Den Zugriff entziehst du jederzeit über **Trennen** im Dashboard oder unter
[myaccount.google.com/permissions](https://myaccount.google.com/permissions).

> Seit der Google-Fotos-Anbindung fragt derselbe Verbinden-Knopf zusätzlich den
> (eingeschränkten) Bereich `photospicker.mediaitems.readonly` mit ab — dafür
> reicht dasselbe Google-Cloud-Projekt, es muss nur zusätzlich die Photos
> Picker API aktiviert werden. Details: **[docs/google-fotos.md](google-fotos.md)**.
> Wer schon vor dieser Änderung verbunden war, muss sich einmal **trennen und
> neu verbinden**, damit das Refresh-Token den neuen Bereich mit umfasst.
