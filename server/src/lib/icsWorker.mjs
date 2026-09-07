import { parentPort, workerData } from 'node:worker_threads';
import { register } from 'tsx/esm/api';
register();
try {
  const { kind, text, source, from, to, horizonDays } = workerData;
  const result = kind === 'calendar'
    ? await (await import('../services/calendar.ts')).parseCalendarText(text, source, new Date(from), new Date(to))
    : (await import('../services/trash.ts')).parseTrashIcs(text, new Date(from), horizonDays);
  parentPort.postMessage({ result });
} catch {
  parentPort.postMessage({ error: 'Kalender konnte nicht sicher verarbeitet werden.' });
}
