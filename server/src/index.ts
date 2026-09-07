import { createApp } from './app.ts';
import fs from 'node:fs';
import { CACHE_DIR, CLIENT_DIST_DIR, DATA_DIR } from './lib/paths.ts';
import { ensureDir } from './lib/jsonStore.ts';
import { loadConfig, onConfigChanged } from './services/config.ts';
import { invalidateCalendarCache, refreshCalendar } from './services/calendar.ts';
import { startHomeAssistantSocket } from './services/homeAssistantSocket.ts';
import { describeError } from './lib/http.ts';

const PORT = Number(process.env.PORT ?? 4000);
// Kiosk lokal; Netzwerkzugriff nur über den konfigurierten HTTPS-Proxy.
const HOST = process.env.HOST ?? '127.0.0.1';

const app = createApp({ password: process.env.DASHBOARD_PASSWORD, origin: process.env.DASHBOARD_ORIGIN });

async function start(): Promise<void> {
  await ensureDir(DATA_DIR);
  await ensureDir(CACHE_DIR);
  await loadConfig();

  // Wer data/config.json von Hand bearbeitet, soll das Ergebnis sofort sehen.
  onConfigChanged(() => {
    invalidateCalendarCache();
    refreshCalendar().catch((error) => {
      console.warn(`[config] Kalender nach Änderung: ${describeError(error)}`);
    });
  });

  app.listen(PORT, HOST, () => {
    console.log(`\n  CINDRALUX Home Command Center — API`);
    console.log(`  http://${HOST}:${PORT}/api/health`);
    console.log(
      fs.existsSync(CLIENT_DIST_DIR)
        ? `  Frontend (build): http://${HOST}:${PORT}\n`
        : `  Frontend im Dev-Modus: npm run dev:client\n`,
    );
  });

  // Kalender einmal beim Start vorwaermen, damit das Dashboard sofort gefuellt ist.
  refreshCalendar().catch((error) => {
    console.warn(`[start] Kalender-Vorlauf fehlgeschlagen: ${describeError(error)}`);
  });

  // Haelt ab hier eine dauerhafte WebSocket-Verbindung zu Home Assistant, statt
  // dass jeder Client-Poll einzeln per REST nachfragt. Reconnect eingebaut.
  startHomeAssistantSocket();
}

start().catch((error) => {
  console.error('Start fehlgeschlagen:', error);
  process.exit(1);
});
