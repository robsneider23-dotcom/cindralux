import ical from "node-ical";
import type {
  CalendarEvent,
  CalendarEventsResponse,
  CalendarFeedStatus,
  CalendarSource,
  CalendarValidation,
} from "../../../shared/types.ts";
import { CALENDAR_CACHE_FILE, SEEDS_DIR } from "../lib/paths.ts";
import { readJson, writeJson } from "../lib/jsonStore.ts";
import { fetchWithTimeout, describeError } from "../lib/http.ts";
import { redactUrls } from "../lib/redact.ts";
import {
  diagnoseIcsUrl,
  fetchFailureHint,
  notACalendarMessage,
} from "../lib/icsDiagnosis.ts";
import { icsText } from "../lib/icsText.ts";
import { addDays, startOfDay, withTime } from "../lib/dates.ts";
import { loadConfig } from "./config.ts";
import { fetchEvents as fetchGoogleEvents } from "./google.ts";
import path from "node:path";
import { createHash } from "node:crypto";

interface SeedEvent {
  calendarId: string;
  title: string;
  dayOffset: number;
  start?: string;
  end?: string;
  allDay?: boolean;
  /** Dauer mehrtaegiger Ganztagestermine. */
  days?: number;
  location?: string;
}

interface CacheFile {
  refreshedAt: string;
  events: CalendarEvent[];
  feeds: CalendarFeedStatus[];
  /**
   * Kurzer Hash je Quelle statt der Adresse selbst.
   *
   * Damit laesst sich erkennen, ob der zwischengespeicherte Stand noch zur
   * konfigurierten Adresse gehoert — ohne die Adresse zu speichern. Der Cache
   * darf das Geheimnis nicht enthalten.
   */
  fingerprints?: Record<string, string>;
}

/** Wie weit zurueck bzw. voraus Events geladen werden. */
const WINDOW_PAST_DAYS = 1;
const WINDOW_FUTURE_DAYS = 30;

let memoryCache: CacheFile | null = null;

/**
 * Die Konfiguration hat sich geaendert — beim naechsten Zugriff neu laden.
 *
 * Bewusst getrennt vom Verwerfen der Daten: Der letzte bekannte Stand ist der
 * Rueckfall, wenn eine Quelle gerade nicht erreichbar ist. Wer ihn beim
 * Speichern der Einstellungen wegwirft, hat im Ernstfall nichts mehr.
 */
let needsRefresh = false;

/** Nicht umkehrbare Kennung einer Adresse — nie die Adresse selbst. */
function fingerprint(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

/* -------------------------------------------------------------------------- */
/* Seed-Daten                                                                  */
/* -------------------------------------------------------------------------- */

async function buildSeedEvents(
  source: CalendarSource,
): Promise<CalendarEvent[]> {
  const seed = await readJson<{ events: SeedEvent[] }>(
    path.join(SEEDS_DIR, "calendar.json"),
  );
  if (!seed) return [];
  const today = startOfDay(new Date());

  return seed.events
    .filter((event) => event.calendarId === source.id)
    .map((event, index) => {
      const day = addDays(today, event.dayOffset);
      const allDay = event.allDay === true;
      const start = allDay ? day : withTime(day, event.start ?? "09:00");
      const end = allDay
        ? addDays(day, Math.max(1, event.days ?? 1))
        : withTime(day, event.end ?? event.start ?? "10:00");

      return {
        id: `seed-${source.id}-${event.dayOffset}-${index}`,
        calendarId: source.id,
        calendarName: source.name,
        calendarColor: source.color,
        title: event.title,
        location: event.location,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay,
      } satisfies CalendarEvent;
    });
}

/* -------------------------------------------------------------------------- */
/* ICS-Verarbeitung                                                            */
/* -------------------------------------------------------------------------- */

/**
 * node-ical liefert Ganztagestermine als `datetype: 'date'`. Zusaetzlich pruefen
 * wir auf exakte Mitternacht mit Tagesvielfachem, weil manche Server DATE-Werte
 * als DATE-TIME mit 00:00 exportieren.
 */
function isAllDay(event: ical.VEvent): boolean {
  if ((event as unknown as { datetype?: string }).datetype === "date")
    return true;
  const start = event.start;
  const end = event.end;
  if (!start || !end) return false;
  const midnight =
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    start.getSeconds() === 0;
  const spansFullDays = (end.getTime() - start.getTime()) % 86_400_000 === 0;
  return midnight && spansFullDays && end.getTime() > start.getTime();
}

/**
 * RRULE-Instanzen ueber Sommer-/Winterzeit hinweg korrigieren.
 *
 * rrule.js rechnet Wiederholungen intern in UTC. Faellt eine Instanz in eine
 * andere DST-Phase als der Serientermin, verschiebt sie sich sonst um eine
 * Stunde. Wir gleichen die Offset-Differenz wieder aus.
 */
function correctDstShift(original: Date, occurrence: Date): Date {
  const diffMinutes =
    occurrence.getTimezoneOffset() - original.getTimezoneOffset();
  if (diffMinutes === 0) return occurrence;
  return new Date(occurrence.getTime() + diffMinutes * 60_000);
}

/** Schluessel, unter dem node-ical EXDATE- und RECURRENCE-ID-Eintraege ablegt. */
function recurrenceKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Ganztaegige Termine auf lokale Mitternacht normalisieren.
 *
 * node-ical liest einen `DTSTART;VALUE=DATE:20260926` als UTC-Mitternacht.
 * Gemeint ist aber der Kalendertag in der Zeit des Betrachters — sonst beginnt
 * ein ganztaegiger Termin hierzulande um 02:00 und faellt aus jedem Vergleich
 * "beginnt der Termin an diesem Tag?" heraus.
 */
function toLocalMidnight(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function expandEvent(
  event: ical.VEvent,
  source: CalendarSource,
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEvent[] {
  const start = event.start;
  const end = event.end ?? event.start;
  if (!start) return [];

  const allDay = isAllDay(event);
  const durationMs = Math.max(0, end.getTime() - start.getTime());

  const make = (rawFrom: Date, rawTo: Date, suffix = ""): CalendarEvent => {
    // Ganztaegig: Anfang auf lokale Mitternacht, Ende ueber die Tagesanzahl.
    // node-ical liefert Anfang und Ende bei DATE-Werten uneinheitlich — aus
    // dem Ende direkt zu normalisieren wuerde die Dauer verschlucken.
    const from = allDay ? toLocalMidnight(rawFrom) : rawFrom;
    const to = allDay
      ? addDays(from, Math.max(1, Math.round((rawTo.getTime() - rawFrom.getTime()) / 86_400_000)))
      : rawTo;
    return {
      id: `${source.id}-${event.uid ?? "evt"}${suffix}-${from.getTime()}`,
      calendarId: source.id,
      calendarName: source.name,
      calendarColor: source.color,
      title: icsText(event.summary) || "Ohne Titel",
      location: icsText(event.location) || undefined,
      description: icsText(event.description).slice(0, 400) || undefined,
      start: from.toISOString(),
      end: to.toISOString(),
      allDay,
    };
  };

  const rrule = (
    event as unknown as {
      rrule?: { between(a: Date, b: Date, inc: boolean): Date[] };
    }
  ).rrule;

  if (!rrule) {
    if (
      end.getTime() < rangeStart.getTime() ||
      start.getTime() > rangeEnd.getTime()
    )
      return [];
    return [make(start, end)];
  }

  const exdates = new Set(
    Object.keys(
      (event as unknown as { exdate?: Record<string, Date> }).exdate ?? {},
    ),
  );
  const overrides =
    (event as unknown as { recurrences?: Record<string, ical.VEvent> })
      .recurrences ?? {};

  const occurrences = rrule.between(
    addDays(rangeStart, -2),
    addDays(rangeEnd, 2),
    true,
  );
  const result: CalendarEvent[] = [];

  for (const raw of occurrences) {
    const occurrence = allDay ? raw : correctDstShift(start, raw);
    const key = recurrenceKey(occurrence);
    if (exdates.has(key)) continue;

    const override = overrides[key];
    if (override?.start) {
      const overrideEnd =
        override.end ?? new Date(override.start.getTime() + durationMs);
      if (overrideEnd.getTime() < rangeStart.getTime()) continue;
      if (override.start.getTime() > rangeEnd.getTime()) continue;
      result.push({
        ...make(override.start, overrideEnd, "-ovr"),
        title:
          icsText(override.summary) || icsText(event.summary) || "Ohne Titel",
      });
      continue;
    }

    const occurrenceEnd = new Date(occurrence.getTime() + durationMs);
    if (occurrenceEnd.getTime() < rangeStart.getTime()) continue;
    if (occurrence.getTime() > rangeEnd.getTime()) continue;
    result.push(make(occurrence, occurrenceEnd, "-rec"));
  }

  return result;
}

async function loadFeed(
  source: CalendarSource,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<{ events: CalendarEvent[]; status: CalendarFeedStatus }> {
  if (!source.enabled) {
    return {
      events: [],
      status: {
        calendarId: source.id,
        name: source.name,
        state: "disabled",
        eventCount: 0,
      },
    };
  }

  // Google-Kalender gehen über die API statt über eine ICS-Adresse.
  if (source.provider === "google-api" && source.googleCalendarId) {
    try {
      const events = await fetchGoogleEvents(source, rangeStart, rangeEnd);
      return {
        events,
        status: {
          calendarId: source.id,
          name: source.name,
          state: "ok",
          eventCount: events.length,
          fetchedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      const reason = redactUrls(describeError(error));
      console.warn(
        `[calendar] Google "${source.name}" fehlgeschlagen: ${reason}`,
      );

      const cached = cachedEventsFor(source);
      if (cached.length > 0) {
        return {
          events: cached,
          status: {
            calendarId: source.id,
            name: source.name,
            state: "stale",
            eventCount: cached.length,
            message: `Nicht erreichbar (${reason}) — letzter bekannter Stand`,
          },
        };
      }

      return {
        events: [],
        status: {
          calendarId: source.id,
          name: source.name,
          state: "error",
          eventCount: 0,
          message: reason,
        },
      };
    }
  }

  if (!source.url.trim()) {
    const events = await buildSeedEvents(source);
    return {
      events,
      status: {
        calendarId: source.id,
        name: source.name,
        state: "seed",
        eventCount: events.length,
        message: events.length
          ? "Demodaten — keine ICS-Adresse hinterlegt"
          : "Noch keine ICS-Adresse hinterlegt",
      },
    };
  }

  try {
    // webcal:// ist nur ein Alias fuer https:// und wird von fetch nicht unterstuetzt.
    const url = source.url.replace(/^webcal:\/\//i, "https://");
    const response = await fetchWithTimeout(url, {
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5" },
    });
    if (!response.ok) {
      throw new Error(
        fetchFailureHint(url, response.status) ?? `HTTP ${response.status}`,
      );
    }

    const text = await response.text();

    // Ein HTML-Fehlerdokument oder die Weboberflaeche wuerde sonst als
    // "erfolgreich mit 0 Terminen" durchgehen — der irrefuehrendste Fall.
    if (!/BEGIN:VCALENDAR/i.test(text)) {
      throw new Error(notACalendarMessage(url));
    }

    const parsed = await ical.async.parseICS(text);
    const events: CalendarEvent[] = [];

    for (const entry of Object.values(parsed)) {
      if (!entry || (entry as ical.VEvent).type !== "VEVENT") continue;
      events.push(
        ...expandEvent(entry as ical.VEvent, source, rangeStart, rangeEnd),
      );
    }

    return {
      events,
      status: {
        calendarId: source.id,
        name: source.name,
        state: "ok",
        eventCount: events.length,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    // Adressen aus der Meldung entfernen, bevor sie ins Log oder in eine
    // Antwort geraet — eine ICS-Adresse ist bei Google das Geheimnis selbst.
    const reason = redactUrls(describeError(error));
    console.warn(`[calendar] "${source.name}" fehlgeschlagen: ${reason}`);

    // Letzten erfolgreichen Stand weiterverwenden, statt die Quelle leer
    // ausfallen zu lassen: ein kurzer Netzaussetzer soll den Kalender nicht
    // vom Dashboard nehmen.
    const cached = cachedEventsFor(source);
    if (cached.length > 0) {
      return {
        events: cached,
        status: {
          calendarId: source.id,
          name: source.name,
          state: "stale",
          eventCount: cached.length,
          message: `Nicht erreichbar (${reason}) — letzter bekannter Stand`,
        },
      };
    }

    return {
      events: [],
      status: {
        calendarId: source.id,
        name: source.name,
        state: "error",
        eventCount: 0,
        message: reason,
      },
    };
  }
}

/**
 * Zuletzt erfolgreich geladene Termine einer Quelle.
 *
 * Nur verwenden, wenn der Cache zur selben Adresse gehoert — sonst zeigte das
 * Dashboard nach einem Adresswechsel die Termine des alten Kalenders weiter.
 */
function cachedEventsFor(source: CalendarSource): CalendarEvent[] {
  if (!memoryCache) return [];

  const stored = memoryCache.fingerprints?.[source.id];
  const current = source.url.trim() ? fingerprint(source.url) : "";
  if (stored && current && stored !== current) return [];

  return memoryCache.events.filter((event) => event.calendarId === source.id);
}

/* -------------------------------------------------------------------------- */
/* Oeffentliche API                                                            */
/* -------------------------------------------------------------------------- */

/** Alle aktiven Quellen abrufen, zusammenfuehren, sortieren und cachen. */
export async function refreshCalendar(range?: {
  from?: Date;
  to?: Date;
}): Promise<CalendarEventsResponse> {
  const config = await loadConfig();
  const rangeStart =
    range?.from ?? addDays(startOfDay(new Date()), -WINDOW_PAST_DAYS);
  const rangeEnd =
    range?.to ?? addDays(startOfDay(new Date()), WINDOW_FUTURE_DAYS);

  const results = await Promise.all(
    config.calendars.map((source) => loadFeed(source, rangeStart, rangeEnd)),
  );

  const events = results
    .flatMap((r) => r.events)
    .sort((a, b) => {
      // Ganztagestermine stehen an ihrem Tag immer oben.
      const byStart = new Date(a.start).getTime() - new Date(b.start).getTime();
      if (byStart !== 0) return byStart;
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.title.localeCompare(b.title, "de");
    });

  const feeds = results.map((r) => r.status);
  const fingerprints = Object.fromEntries(
    config.calendars
      .filter((source) => source.url.trim())
      .map((source) => [source.id, fingerprint(source.url)]),
  );
  const payload: CacheFile = {
    refreshedAt: new Date().toISOString(),
    events,
    feeds,
    fingerprints,
  };

  memoryCache = payload;
  await writeJson(CALENDAR_CACHE_FILE, payload).catch((error) => {
    console.warn(
      `[calendar] Cache konnte nicht geschrieben werden: ${describeError(error)}`,
    );
  });

  return {
    events,
    feeds,
    refreshedAt: payload.refreshedAt,
    usesSeedData: feeds.some((f) => f.state === "seed"),
  };
}

/**
 * Events aus dem Cache. Ist der Cache aelter als das konfigurierte Intervall
 * (oder leer), wird im Hintergrund neu geladen.
 */
export async function getCalendarEvents(
  force = false,
  range?: { from?: Date; to?: Date },
): Promise<CalendarEventsResponse> {
  const config = await loadConfig();

  if (!memoryCache) {
    memoryCache = await readJson<CacheFile>(CALENDAR_CACHE_FILE);
  }

  const ageMs = memoryCache
    ? Date.now() - new Date(memoryCache.refreshedAt).getTime()
    : Infinity;
  const outdated = ageMs > config.calendarRefreshMinutes * 60_000;

  if (force || needsRefresh || !memoryCache || outdated) {
    needsRefresh = false;
    const fresh = await refreshCalendar();
    return range
      ? { ...fresh, events: withinRange(fresh.events, range) }
      : fresh;
  }

  return {
    events: range ? withinRange(memoryCache.events, range) : memoryCache.events,
    feeds: memoryCache.feeds,
    refreshedAt: memoryCache.refreshedAt,
    usesSeedData: memoryCache.feeds.some((f) => f.state === "seed"),
  };
}

/** Konfiguration hat sich geaendert — der Cache passt nicht mehr. */
export function invalidateCalendarCache(): void {
  needsRefresh = true;
}

/* -------------------------------------------------------------------------- */
/* Pruefung einer ICS-Adresse beim Hinzufuegen                                 */
/* -------------------------------------------------------------------------- */

/**
 * ICS-Zeilen entfalten. Nach RFC 5545 werden lange Werte umbrochen und mit
 * einem fuehrenden Leerzeichen bzw. Tab fortgesetzt.
 */
function unfold(text: string): string {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function readProperty(text: string, name: string): string | undefined {
  const match = new RegExp(`^${name}(?:;[^:\n]*)?:(.*)$`, "im").exec(text);
  return match?.[1]?.trim() || undefined;
}

/**
 * Adresse einmal abrufen und pruefen, ob wirklich ein Kalender dahintersteckt.
 * Liefert Name und Terminanzahl zurueck, damit die Oberflaeche das Feld
 * vorbefuellen und den Erfolg belegen kann.
 */
export async function validateCalendarUrl(
  rawUrl: string,
): Promise<CalendarValidation> {
  const url = rawUrl.trim().replace(/^webcal:\/\//i, "https://");

  if (!url) {
    return { ok: false, message: "Keine Adresse angegeben" };
  }

  if (!/^https?:\/\//i.test(url)) {
    return {
      ok: false,
      message: "Die Adresse muss mit http:// oder https:// beginnen",
    };
  }

  const isGoogle = /calendar\.google\.com/i.test(url);
  const provider: "ics" | "google" = isGoogle ? "google" : "ics";

  const hint = isGoogle ? diagnoseIcsUrl(url) : null;
  if (hint) return { ok: false, provider, message: hint };

  try {
    const response = await fetchWithTimeout(url, {
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5" },
    });

    if (response.status === 404) {
      return {
        ok: false,
        provider,
        message: isGoogle
          ? "Google kennt diese Adresse nicht (404). Wurde die Privatadresse " +
            "zurückgesetzt? Dann in Google eine neue erzeugen."
          : "Adresse nicht gefunden (404)",
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        provider,
        message: `Server antwortete mit HTTP ${response.status}`,
      };
    }

    const text = unfold(await response.text());

    if (!/BEGIN:VCALENDAR/i.test(text)) {
      return {
        ok: false,
        provider,
        message:
          "Die Adresse liefert keinen Kalender, sondern etwas anderes " +
          "(vermutlich eine HTML-Seite).",
      };
    }

    const eventCount = (text.match(/BEGIN:VEVENT/gi) ?? []).length;
    const name = readProperty(text, "X-WR-CALNAME");
    const timezone = readProperty(text, "X-WR-TIMEZONE");

    return {
      ok: true,
      name,
      eventCount,
      timezone,
      provider,
      message:
        eventCount > 0
          ? `${eventCount} Termine gefunden`
          : "Kalender erreichbar, enthält aber derzeit keine Termine",
    };
  } catch (error) {
    return { ok: false, provider, message: describeError(error) };
  }
}

/** Termine auf ein Zeitfenster einschraenken; ueberlappende zaehlen mit. */
function withinRange(
  events: CalendarEvent[],
  range: { from?: Date; to?: Date },
): CalendarEvent[] {
  const from = range.from?.getTime();
  const to = range.to?.getTime();

  return events.filter((event) => {
    const start = new Date(event.start).getTime();
    const end = new Date(event.end).getTime();
    if (from !== undefined && end < from) return false;
    if (to !== undefined && start > to) return false;
    return true;
  });
}
