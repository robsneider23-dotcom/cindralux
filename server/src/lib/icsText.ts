/**
 * Textwert aus einer ICS-Eigenschaft holen.
 *
 * Traegt eine Eigenschaft Parameter — etwa `SUMMARY;LANGUAGE=de:Bio` —, liefert
 * node-ical kein String, sondern ein Objekt der Form `{ params, val }`.
 * Ein blosses String(...) ergaebe dann "[object Object]".
 */
export function icsText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'val' in value) {
    return String((value as { val: unknown }).val ?? '').trim();
  }
  return value == null ? '' : String(value).trim();
}
