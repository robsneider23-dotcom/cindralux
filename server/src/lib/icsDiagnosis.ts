/**
 * Erklaert, warum eine Adresse keinen Kalender liefert.
 *
 * Die Meldungen enthalten bewusst nie die Adresse selbst — bei Google ist sie
 * das Geheimnis. Sie beschreiben stattdessen, welcher Link verwechselt wurde.
 */
export function diagnoseIcsUrl(url: string): string | null {
  if (!/calendar\.google\.com/i.test(url)) return null;

  if (/\/calendar\/embed/i.test(url)) {
    return (
      'Das ist die Einbettungs-Adresse für eine Webseite, kein iCal-Feed. ' +
      'In den Kalendereinstellungen weiter unten den Abschnitt "Kalender integrieren" ' +
      'öffnen und dort die "Privatadresse im iCal-Format" nehmen.'
    );
  }
  if (/\/calendar\/u\/\d/i.test(url) && !/\.ics(\?|$)/i.test(url)) {
    return (
      'Das ist die Adresse der Google-Kalender-Weboberfläche. Gebraucht wird die ' +
      'Adresse aus "Privatadresse im iCal-Format", sie endet auf .ics'
    );
  }
  // Die oeffentliche Adresse ist ausdruecklich zulaessig: Sie liefert die
  // Termine eines oeffentlich geteilten Kalenders. Frueher wurde sie hier
  // pauschal abgelehnt — das war falsch. Ob sie funktioniert, entscheidet der
  // Abruf; schlaegt er fehl, erklaert notAvailableHint() den Grund.
  return null;
}

/**
 * Zusatzhinweis, wenn ein Abruf fehlschlaegt.
 *
 * Bei einer oeffentlichen Google-Adresse ist die haeufigste Ursache, dass der
 * Kalender gar nicht oeffentlich geteilt ist — dann antwortet Google mit 404.
 */
export function fetchFailureHint(url: string, status?: number): string | null {
  if (!/calendar\.google\.com/i.test(url)) return null;
  if (/\/public\//i.test(url) && (status === 404 || status === 403)) {
    return (
      'Die öffentliche Adresse funktioniert nur, wenn der Kalender in Google ' +
      'unter "Zugriffsberechtigungen" auf "Öffentlich verfügbar" steht. ' +
      'Sonst die Privatadresse im iCal-Format verwenden.'
    );
  }
  return null;
}

/** Meldung, wenn die Antwort kein Kalender ist. */
export function notACalendarMessage(url: string): string {
  return (
    diagnoseIcsUrl(url) ??
    'Die Adresse liefert keinen Kalender, sondern etwas anderes (vermutlich eine HTML-Seite).'
  );
}
