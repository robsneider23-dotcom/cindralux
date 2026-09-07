import express, { type ErrorRequestHandler } from 'express';
import fs from 'node:fs';
import { api } from './routes/api.ts';
import { ASSETS_DIR, CLIENT_DIST_DIR } from './lib/paths.ts';
import { securityHeaders, createAccessControl, apiRequestGuard, rateLimit, assertSafeJson, type SecurityOptions } from './lib/security.ts';

/** Ohne Start-Nebenwirkungen importierbar, damit die Sicherheitsgrenze testbar ist. */
export function createApp(options: SecurityOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(createAccessControl(options));
  app.use('/api', apiRequestGuard);
  app.use('/api', rateLimit(600));
  app.use('/api', rateLimit(90, (req) => !['GET', 'HEAD'].includes(req.method)));
  app.use('/api', rateLimit(20, (req) => req.path.startsWith('/ai/') || req.path.startsWith('/test/') || req.path.endsWith('/validate')));
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', (req, res, next) => {
    try { assertSafeJson(req.body); next(); }
    catch { res.status(400).json({ error: 'Ungültige JSON-Struktur.' }); }
  });
  app.use('/api', api);

  // Cindralux-Assets direkt aus /assets — dieselben Pfade wie im Dev-Server.
  app.use('/cindralux', express.static(`${ASSETS_DIR}/cindralux`, { maxAge: '1h' }));

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

  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = error?.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
    res.status(status).json({ error: status === 413 ? 'Anfrage zu groß.' : status === 400 ? 'Ungültiges JSON.' : 'Interner Fehler.' });
  };
  app.use(handleError);
  return app;
}
