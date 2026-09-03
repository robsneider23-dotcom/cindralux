import type { AppTimer, CreateTimerRequest, TimerListResponse } from '../../../shared/types.ts';
import { DATA_DIR } from '../lib/paths.ts';
import { readJson, writeJson } from '../lib/jsonStore.ts';
import { describeError } from '../lib/http.ts';
import path from 'node:path';

/**
 * Timer und Wecker.
 *
 * Beide liegen in derselben Liste, verhalten sich aber unterschiedlich:
 * Ein Timer läuft einmal ab und verschwindet nach dem Bestätigen. Ein Wecker
 * mit Wochentagen stellt sich nach dem Klingeln auf den nächsten Termin.
 *
 * Gespeichert wird in data/timers.json, damit ein Neustart des Pi einen
 * gestellten Wecker nicht verschluckt. Kurze Küchentimer überstehen einen
 * Neustart bewusst nicht — sie wären danach ohnehin abgelaufen.
 */

const TIMERS_FILE = path.join(DATA_DIR, 'timers.json');

/** Länger abgelaufene Timer werden beim Aufräumen entfernt. */
const STALE_AFTER_MS = 60 * 60_000;

let timers: AppTimer[] | null = null;

let counter = 0;
function nextId(): string {
  counter += 1;
  return `t-${Date.now().toString(36)}-${counter}`;
}

async function load(): Promise<AppTimer[]> {
  if (timers) return timers;
  const stored = await readJson<{ timers: AppTimer[] }>(TIMERS_FILE);
  // Beim Start nur Wecker übernehmen — Timer wären längst abgelaufen.
  timers = (stored?.timers ?? []).filter((entry) => entry.kind === 'alarm');
  return timers;
}

async function persist(): Promise<void> {
  // Nur Wecker sichern; Timer sind flüchtig.
  const durable = (timers ?? []).filter((entry) => entry.kind === 'alarm');
  await writeJson(TIMERS_FILE, { timers: durable }).catch((error) => {
    console.warn(`[timers] Konnte nicht gespeichert werden: ${describeError(error)}`);
  });
}

/** Nächsten passenden Zeitpunkt für "HH:MM" finden, ggf. an Wochentagen. */
function nextOccurrence(time: string, weekdays: number[] | undefined, from = new Date()): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const candidate = new Date(from);
  candidate.setHours(hours ?? 0, minutes ?? 0, 0, 0);

  if (!weekdays || weekdays.length === 0) {
    // Einmalig: heute, sonst morgen.
    if (candidate.getTime() <= from.getTime()) candidate.setDate(candidate.getDate() + 1);
    return candidate;
  }

  // Wiederkehrend: bis zu sieben Tage vorspulen, bis ein Wochentag passt.
  for (let offset = 0; offset < 8; offset += 1) {
    const day = new Date(candidate);
    day.setDate(day.getDate() + offset);
    if (weekdays.includes(day.getDay()) && day.getTime() > from.getTime()) return day;
  }

  return candidate;
}

/**
 * Fällige Einträge auf `ringing` setzen. Wird bei jedem Abruf ausgeführt —
 * der Client fragt sekündlich, ein eigener Scheduler wäre unnötig.
 */
function markDue(list: AppTimer[]): { list: AppTimer[]; changed: boolean } {
  const now = Date.now();
  let changed = false;

  const next = list.filter((entry) => {
    // Abgelaufene, bereits bestätigte Einträge irgendwann entfernen.
    if (!entry.ringing && !entry.enabled && now - new Date(entry.dueAt).getTime() > STALE_AFTER_MS) {
      changed = true;
      return false;
    }
    return true;
  });

  for (const entry of next) {
    if (entry.enabled && !entry.ringing && new Date(entry.dueAt).getTime() <= now) {
      entry.ringing = true;
      changed = true;
    }
  }

  return { list: next, changed };
}

export async function listTimers(): Promise<TimerListResponse> {
  const current = await load();
  const { list, changed } = markDue(current);
  timers = list;
  if (changed) await persist();

  return {
    timers: [...list].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
    serverTime: new Date().toISOString(),
  };
}

export async function createTimer(request: CreateTimerRequest): Promise<AppTimer> {
  const list = await load();
  const now = new Date();

  let dueAt: Date;
  let durationSeconds: number | undefined;

  if (request.kind === 'alarm') {
    if (!request.time || !/^\d{1,2}:\d{2}$/.test(request.time)) {
      throw new Error('Für einen Wecker wird eine Uhrzeit im Format HH:MM gebraucht');
    }
    dueAt = nextOccurrence(request.time, request.repeatWeekdays, now);
  } else {
    const seconds = Math.round(request.seconds ?? 0);
    if (!Number.isFinite(seconds) || seconds < 1) {
      throw new Error('Für einen Timer wird eine Laufzeit in Sekunden gebraucht');
    }
    if (seconds > 24 * 3600) {
      throw new Error('Ein Timer kann höchstens 24 Stunden laufen — dafür lieber einen Wecker stellen');
    }
    durationSeconds = seconds;
    dueAt = new Date(now.getTime() + seconds * 1000);
  }

  const timer: AppTimer = {
    id: nextId(),
    kind: request.kind,
    label: request.label?.trim() || (request.kind === 'alarm' ? 'Wecker' : 'Timer'),
    dueAt: dueAt.toISOString(),
    durationSeconds,
    repeatWeekdays: request.repeatWeekdays?.length ? request.repeatWeekdays : undefined,
    createdAt: now.toISOString(),
    ringing: false,
    enabled: true,
  };

  list.push(timer);
  timers = list;
  await persist();
  return timer;
}

/** Klingeln bestätigen. Wiederkehrende Wecker rücken auf den nächsten Termin. */
export async function dismissTimer(id: string): Promise<AppTimer | null> {
  const list = await load();
  const entry = list.find((item) => item.id === id);
  if (!entry) return null;

  entry.ringing = false;

  if (entry.kind === 'alarm' && entry.repeatWeekdays?.length) {
    const time = new Date(entry.dueAt);
    const hhmm = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
    entry.dueAt = nextOccurrence(hhmm, entry.repeatWeekdays).toISOString();
  } else {
    entry.enabled = false;
  }

  timers = list;
  await persist();
  return entry;
}

export async function deleteTimer(id: string): Promise<boolean> {
  const list = await load();
  const next = list.filter((entry) => entry.id !== id);
  const removed = next.length !== list.length;
  timers = next;
  if (removed) await persist();
  return removed;
}

/** Alles Klingelnde auf einmal bestätigen — für den „Alle aus"-Knopf. */
export async function dismissAllRinging(): Promise<number> {
  const list = await load();
  const ringing = list.filter((entry) => entry.ringing);
  for (const entry of ringing) await dismissTimer(entry.id);
  return ringing.length;
}
