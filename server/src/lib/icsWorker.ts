import { Worker } from 'node:worker_threads';
import type { CalendarEvent, CalendarSource, TrashPickup } from '../../../shared/types.ts';

let active = 0;
const waiting: Array<() => void> = [];
async function slot(): Promise<void> {
  if (active < 2) { active++; return; }
  if (waiting.length >= 20) throw new Error('Zu viele Kalender werden gleichzeitig verarbeitet.');
  await new Promise<void>((resolve) => waiting.push(resolve));
}
function release(): void {
  const next = waiting.shift();
  if (next) next(); else active--;
}

/** Fremde ICS-Dateien einschließlich RRULE-Auswertung laufen außerhalb des API-Threads. */
async function run<T>(data: { text: string; [key: string]: unknown }): Promise<T> {
  if (Buffer.byteLength(data.text) > 8 * 1024 * 1024) throw new Error('Kalenderdatei ist zu groß.');
  await slot();
  try {
    return await new Promise<T>((resolve, reject) => {
      const worker = new Worker(new URL('./icsWorker.mjs', import.meta.url), {
        workerData: data,
        resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
      });
      let finished = false;
      const done = (error?: Error, result?: T) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        void worker.terminate();
        if (error) reject(error); else resolve(result as T);
      };
      const timer = setTimeout(() => done(new Error('Zeitlimit für Kalenderverarbeitung erreicht.')), 12_000);
      worker.once('message', (message: { error?: string; result?: T }) => done(message.error ? new Error(message.error) : undefined, message.result));
      worker.once('error', () => done(new Error('Kalenderverarbeitung wurde abgebrochen.')));
      worker.once('exit', () => { if (!finished) done(new Error('Kalenderverarbeitung wurde abgebrochen.')); });
    });
  } finally { release(); }
}

export function parseCalendarIsolated(text: string, source: CalendarSource, from: Date, to: Date): Promise<CalendarEvent[]> {
  return run({ kind: 'calendar', text, source, from: from.toISOString(), to: to.toISOString() });
}
export function parseTrashIsolated(text: string, from: Date, horizonDays: number): Promise<TrashPickup[]> {
  return run({ kind: 'trash', text, from: from.toISOString(), horizonDays });
}
