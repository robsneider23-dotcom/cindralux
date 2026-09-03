/** Zentrale Formatierer — alle in de-DE, alle mit 24-Stunden-Uhr. */

const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });
const weekdayLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long' });
const weekdayShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const dateLong = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
const dateShort = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });

export function formatTime(value: string | Date): string {
  return time.format(typeof value === 'string' ? new Date(value) : value);
}

export function formatWeekday(value: string | Date): string {
  return weekdayLong.format(typeof value === 'string' ? new Date(value) : value);
}

export function formatWeekdayShort(value: string | Date): string {
  return weekdayShort.format(typeof value === 'string' ? new Date(value) : value);
}

export function formatDateLong(value: string | Date): string {
  return dateLong.format(typeof value === 'string' ? new Date(value) : value);
}

export function formatDateShort(value: string | Date): string {
  return dateShort.format(typeof value === 'string' ? new Date(value) : value);
}

/** Temperatur ohne Nachkommastelle — auf 2 m Entfernung zaehlt nur die Zahl. */
export function formatTemp(value: number): string {
  return `${Math.round(value)}°`;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** "Heute", "Morgen" oder der Wochentag — nie ein nacktes Datum in der Agenda. */
export function relativeDayLabel(date: Date, reference = new Date()): string {
  const diff = Math.round(
    (startOfDay(date).getTime() - startOfDay(reference).getTime()) / 86_400_000,
  );
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  if (diff === -1) return 'Gestern';
  return weekdayLong.format(date);
}

/** "in 25 Min", "in 3 Std", "läuft" — fuer den naechsten Termin. */
export function relativeTimeLabel(start: Date, end: Date, now = new Date()): string {
  if (now >= start && now <= end) return 'läuft';
  if (now > end) return 'vorbei';

  const minutes = Math.round((start.getTime() - now.getTime()) / 60_000);
  if (minutes < 1) return 'gleich';
  if (minutes < 60) return `in ${minutes} Min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest > 0 ? `in ${hours} Std ${rest} Min` : `in ${hours} Std`;
  }

  const days = Math.round(hours / 24);
  return `in ${days} Tag${days === 1 ? '' : 'en'}`;
}

/** Dauer eines Termins, z.B. "1 Std 30 Min". */
export function formatDuration(start: Date, end: Date): string {
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} Min`;
  if (rest === 0) return `${hours} Std`;
  return `${hours} Std ${rest} Min`;
}
