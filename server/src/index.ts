import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import { api } from './routes/api.ts';
import { ASSETS_DIR, CACHE_DIR, CLIENT_DIST_DIR, DATA_DIR } from './lib/paths.ts';
import { ensureDir } from './lib/jsonStore.ts';
import { loadConfig, onConfigChanged } from './services/config.ts';
import { invalidateCalendarCache, refreshCalendar } from './services/calendar.ts';
import { describeError } from './lib/http.ts';

const PORT = Number(process.env.PORT ?? 4000);
// Auf dem Pi spaeter 0.0.0.0, damit das Dashboard auch vom Handy erreichbar ist.
const HOST = process.env.HOST ?? '127.0.0.1';

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: '256kb' }));

app.use('/api', api);

// Rubicon-Assets direkt aus /assets — dieselben Pfade wie im Dev-Server.
app.use('/rubicon', express.static(`${ASSETS_DIR}/rubicon`, { maxAge: '1h' }));

// Produktionsbetrieb: gebautes Frontend mit ausliefern, damit im Kiosk-Modus
// nur ein einziger Prozess laeuft.
if (fs.existsSync(CLIENT_DIST_DIR)) {
  // Asset-Dateinamen tragen einen Hash und duerfen lange gecacht werden.
  app.use(express.static(CLIENT_DIST_DIR, { maxAge: '1h', index: false }));

  // index.html dagegen nie cachen: sonst laedt der Pi nach einem Update
  // weiterhin die alte Seite und verweist auf geloeschte Asset-Dateien.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.set('Cache-Control', 'no-store');
    res.sendFile(`${CLIENT_DIST_DIR}/index.html`);
  });
}

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
    console.log(`\n  RUBICON Home Command Center — API`);
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
}

start().catch((error) => {
  console.error('Start fehlgeschlagen:', error);
  process.exit(1);
});
