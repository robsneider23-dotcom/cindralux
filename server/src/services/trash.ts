import ical from 'node-ical';
import { parseTrashIsolated } from '../lib/icsWorker.ts';
import type { TrashKind, TrashPickup, TrashResponse, TrashRule } from '../../../shared/types.ts';
import { addDays, daysBetween, fromDateKey, startOfDay, toDateKey } from '../lib/dates.ts';
import { fetchWithTimeout, describeError } from '../lib/http.ts';
import { icsText } from '../lib/icsText.ts';
import { diagnoseIcsUrl } from '../lib/icsDiagnosis.ts';
import { loadConfig } from './config.ts';
import { trashPalette } from './trashPalette.ts';

/** Wie weit voraus Abholtermine berechnet werden. */
const HORIZON_DAYS = 42;

/**
 * Naechsten Termin einer Regel ab `from` finden.
 *
 * Der Rhythmus haengt am Ankerdatum: bei everyNWeeks = 2 zaehlt, ob die
 * Kalenderwoche des Termins eine gerade Anzahl Wochen nach dem Anker liegt.
 */
function occurrencesForRule(rule: TrashRule, from: Date, horizonDays: number): TrashPickup[] {
  const anchor = startOfDay(fromDateKey(rule.anchorDate));
  const everyN = Math.max(1, Math.round(rule.everyNWeeks));
  const result: TrashPickup[] = [];

  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const day = addDays(from, offset);
    if (day.getDay() !== rule.weekday) continue;

    const weeksSinceAnchor = Math.round(daysBetween(anchor, day) / 7);
    // Modulo, das auch fuer Termine vor dem Anker korrekt ist.
    if (((weeksSinceAnchor % everyN) + everyN) % everyN !== 0) continue;

    const daysUntil = daysBetween(from, day);
    result.push({
      id: `${rule.id}-${toDateKey(day)}`,
      kind: rule.kind,
      label: rule.label,
      color: rule.color,
      date: toDateKey(day),
      daysUntil,
      isToday: daysUntil === 0,
      isTomorrow: daysUntil === 1,
    });
  }

  return result;
}

export async function getTrashSchedule(): Promise<TrashResponse> {
  const config = await loadConfig();
  const today = startOfDay(new Date());

  if (config.trash.source === 'ics') {
    return trashFromIcs(config.trash, today);
  }

  const active = config.trashRules.filter((rule) => rule.enabled);
  if (active.length === 0) {
    return { next: null, upcoming: [], source: 'none' };
  }

  const upcoming = active
    .flatMap((rule) => occurrencesForRule(rule, today, HORIZON_DAYS))
    .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label, 'de'));

  return { next: upcoming[0] ?? null, upcoming, source: 'rules' };
}

/** Termine aus der ICS-Quelle: erst die URL, sonst die hochgeladene Datei. */
async function trashFromIcs(
  trash: { icsUrl: string; icsContent: string },
  today: Date,
): Promise<TrashResponse> {
  try {
    const text = trash.icsUrl.trim()
      ? await loadTrashIcs(trash.icsUrl.trim(), true)
      : trash.icsContent;

    if (!text.trim()) {
      return {
        next: null,
        upcoming: [],
        source: 'none',
        message: 'Keine ICS-Adresse und keine Datei hinterlegt',
      };
    }

    const upcoming = (await parseTrashIsolated(text, today, HORIZON_DAYS)).sort(
      (a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label, 'de'),
    );

    return { next: upcoming[0] ?? null, upcoming, source: 'ics' };
  } catch (error) {
    console.warn(`[trash] ICS-Quelle nicht lesbar: ${describeError(error)}`);
    return { next: null, upcoming: [], source: 'none', message: describeError(error) };
  }
}

/* -------------------------------------------------------------------------- */
/* Abfuhrkalender aus einer ICS-Quelle                                         */
/* -------------------------------------------------------------------------- */

/**
 * Tonnenart aus der Terminbezeichnung ableiten.
 *
 * Entsorger benennen ihre Termine sehr unterschiedlich — "Restmuell
 * 2-woechentlich", "Restabfall", "Graue Tonne". Deshalb wird auf Stichworte
 * geprueft statt auf exakte Gleichheit, und Umlaute werden vorher normalisiert.
 */
function classify(summary: string): { kind: TrashKind; label: string } {
  const text = summary
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');

  if (/gelb|wertstoff|verpackung|lvp|plastik/.test(text)) {
    return { kind: 'gelber-sack', label: 'Gelber Sack' };
  }
  if (/bio|gruen(?!schnitt)|kompost/.test(text)) return { kind: 'bio', label: 'Biotonne' };
  if (/papier|pappe|karton|blau/.test(text)) return { kind: 'papier', label: 'Papier' };
  if (/glas/.test(text)) return { kind: 'glas', label: 'Glas' };
  if (/sperr|gross/.test(text)) return { kind: 'sperrmuell', label: 'Sperrmüll' };
  if (/rest|schwarz|grau|hausmuell/.test(text)) return { kind: 'restmuell', label: 'Restmüll' };

  // Unbekannt: Originalbezeichnung behalten, damit nichts verloren geht.
  return { kind: 'restmuell', label: summary.trim() || 'Abholung' };
}

/** ICS-Text in Abholtermine uebersetzen. */
export function parseTrashIcs(text: string, from: Date, horizonDays: number): TrashPickup[] {
  const parsed = ical.sync.parseICS(text);
  const until = addDays(from, horizonDays);
  const pickups: TrashPickup[] = [];

  for (const entry of Object.values(parsed)) {
    const event = entry as ical.VEvent;
    if (!event || event.type !== 'VEVENT' || !event.start) continue;

    const day = startOfDay(new Date(event.start));
    if (day < from || day > until) continue;

    const { kind, label } = classify(icsText(event.summary));
    const daysUntil = daysBetween(from, day);

    pickups.push({
      id: `ics-${kind}-${toDateKey(day)}`,
      kind,
      label,
      color: trashPalette[kind],
      date: toDateKey(day),
      daysUntil,
      isToday: daysUntil === 0,
      isTomorrow: daysUntil === 1,
    });
  }

  return pickups;
}

/** Cache der ICS-Quelle — der Abfuhrkalender aendert sich hoechstens taeglich. */
let icsCache: { at: number; text: string; url: string } | null = null;
const ICS_TTL_MS = 6 * 3600_000;

async function loadTrashIcs(url: string, allowPrivate = false): Promise<string> {
  if (icsCache && icsCache.url === url && allowPrivate && Date.now() - icsCache.at < ICS_TTL_MS) {
    return icsCache.text;
  }

  const response = await fetchWithTimeout(url.replace(/^webcal:\/\//i, 'https://'), {
    headers: { Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5' },
  }, 10_000, { allowPrivate });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const text = await response.text();
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new Error('Die Adresse liefert keinen Kalender');
  }

  icsCache = { at: Date.now(), text, url };
  return text;
}

export function invalidateTrashCache(): void {
  icsCache = null;
}

/** Eine ICS-Quelle pruefen, bevor sie gespeichert wird. */
export async function validateTrashIcs(
  url: string,
): Promise<{ ok: boolean; message: string; count?: number }> {
  const hint = diagnoseIcsUrl(url);
  if (hint) return { ok: false, message: hint };

  try {
    const text = await loadTrashIcs(url.trim());
    const today = startOfDay(new Date());
    const pickups = await parseTrashIsolated(text, today, 365);
    const kinds = [...new Set(pickups.map((entry) => entry.label))];
    return {
      ok: pickups.length > 0,
      count: pickups.length,
      message: pickups.length
        ? `${pickups.length} Termine gefunden: ${kinds.join(', ')}`
        : 'Kalender erreichbar, enthält aber keine kommenden Abfuhrtermine',
    };
  } catch (error) {
    return { ok: false, message: describeError(error) };
  }
}
