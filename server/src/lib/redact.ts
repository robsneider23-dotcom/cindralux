/**
 * Schutz vor versehentlich ausgeplauderten Adressen.
 *
 * Eine ICS-Adresse von Google ist eine Geheimadresse — wer sie hat, liest den
 * Kalender mit. Sie darf deshalb weder in eine API-Antwort noch in eine
 * Logzeile geraten. Node selbst haengt die URL zwar nicht an fetch-Fehler,
 * aber Bibliotheken und kuenftige Codepfade koennten es tun.
 */

/** Jede vollstaendige URL aus einem Text entfernen. */
export function redactUrls(text: string): string {
  return text.replace(/\b(?:https?|webcal):\/\/\S+/gi, '[Adresse entfernt]');
}

/**
 * Ungefaehrlicher Wiedererkennungs-Hinweis: Host und Dateiname, ohne den
 * geheimen Pfad dazwischen. Aus
 * `https://calendar.google.com/calendar/ical/x%40y/private-TOKEN/basic.ics`
 * wird `calendar.google.com/…/basic.ics`.
 */
export function urlHint(rawUrl: string): string | undefined {
  const value = rawUrl.trim();
  if (!value) return undefined;

  try {
    const parsed = new URL(value.replace(/^webcal:\/\//i, 'https://'));
    const segments = parsed.pathname.split('/').filter(Boolean);
    const last = segments.at(-1);
    // Nur den letzten Abschnitt zeigen, und auch den nur, wenn er harmlos
    // aussieht — ein langer Zufallsstring waere selbst schon das Geheimnis.
    const safeLast = last && /^(?:basic|calendar|feed)\.ics$/i.test(last)
      ? last
      : undefined;
    return safeLast ? `${parsed.host}/…/${safeLast}` : parsed.host;
  } catch {
    return 'ungültige Adresse';
  }
}

let secrets: string[] = [];
export function registerSecrets(values: string[]): void {
  secrets = [...new Set(values.filter((value) => value.length >= 4))].sort((a, b) => b.length - a.length);
}
export function redactSecrets(message: string): string {
  for (const secret of secrets) message = message.replaceAll(secret, '[Geheimnis entfernt]');
  return message;
}
