import os from 'node:os';
import { z } from 'zod';
import { Router, type NextFunction, type Request, type Response } from 'express';
import type {
  AiChatRequest,
  AppConfigPatch,
  CreateEventRequest,
  CreateNoteRequest,
  CreateShoppingItemRequest,
  CreateTimerRequest,
  DailyBriefingRequest,
  HealthResponse,
  HomeAssistantCallRequest,
} from '../../../shared/types.ts';
import { loadConfig, saveConfig, toPublicConfig } from '../services/config.ts';
import { readInputDevices } from '../services/input.ts';
import { powerAction, powerAvailable } from '../services/power.ts';
import {
  getCalendarEvents,
  invalidateCalendarCache,
  refreshCalendar,
  validateCalendarUrl,
} from '../services/calendar.ts';
import {
  getTrashSchedule,
  invalidateTrashCache,
  validateTrashIcs,
} from '../services/trash.ts';
import { describeCoordinates, searchPlaces } from '../services/geocoding.ts';
import {
  activePhotos,
  cancelGooglePickerSession,
  googlePickerSessionStatus,
  importGooglePickerSession,
  listPhotos,
  resolvePhotoPath,
  setPhotoFocus,
  setPhotoPerson,
  startGooglePickerSession,
} from '../services/photos.ts';
import {
  buildAuthUrl,
  consumeOAuthState,
  createEvent as createGoogleEvent,
  disconnect as googleDisconnect,
  exchangeCode,
  getStatus as googleStatus,
  invalidateGoogleToken,
  listCalendars as listGoogleCalendars,
  redirectUri,
} from '../services/google.ts';
import { getWeather, invalidateWeatherCache } from '../services/weather.ts';
import {
  callService,
  getStatus,
  invalidateEntityCache,
  listEntities,
  readSensors,
} from '../services/homeAssistant.ts';
import {
  createTimer,
  deleteTimer,
  dismissAllRinging,
  dismissTimer,
  listTimers,
} from '../services/timers.ts';
import {
  addNote,
  addShoppingItem,
  clearCheckedShoppingItems,
  deleteNote,
  deleteShoppingItem,
  getLists,
  toggleShoppingItem,
} from '../services/lists.ts';
import { chat, dailyBriefing, testAiConnection } from '../services/ai.ts';
import { createRealtimeSession, RealtimeError, testRealtime } from '../services/realtime.ts';
import { openGptLive } from '../services/gptLive.ts';
import { describeError } from '../lib/http.ts';
import { escapeHtml } from '../lib/security.ts';
import { readCpuTemperatureC } from '../lib/systemTemp.ts';

export const api = Router();

const startedAt = Date.now();

/** Async-Handler mit Fehlerweiterleitung — spart try/catch in jeder Route. */
function route(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}

/* -------------------------------------------------------------------------- */
/* Health / System                                                             */
/* -------------------------------------------------------------------------- */

api.get(
  '/health',
  route(async (_req, res) => {
    const total = os.totalmem();
    const used = total - os.freemem();

    const payload: HealthResponse = {
      ok: true,
      service: 'cindralux-home-command-center',
      version: '1.0.0',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      system: {
        hostname: os.hostname(),
        platform: `${os.type()} ${os.arch()}`,
        loadAverage: Math.round((os.loadavg()[0] ?? 0) * 100) / 100,
        memoryUsedPercent: Math.round((used / total) * 100),
        temperatureC: await readCpuTemperatureC(),
      },
      time: new Date().toISOString(),
    };

    res.json(payload);
  }),
);

/* -------------------------------------------------------------------------- */
/* Konfiguration                                                               */
/* -------------------------------------------------------------------------- */

api.get(
  '/config',
  route(async (_req, res) => {
    res.json(toPublicConfig(await loadConfig()));
  }),
);

api.put(
  '/config',
  route(async (req, res) => {
    const patch = (req.body ?? {}) as AppConfigPatch;
    const current = await loadConfig();
    if (!res.locals.deviceLocal && (
      (patch.ai?.gptLive?.command !== undefined && patch.ai.gptLive.command !== current.ai.gptLive.command) ||
      (patch.photos?.localDir !== undefined && patch.photos.localDir !== current.photos.localDir)
    )) {
      res.status(403).json({ error: 'Gerätebefehle und Bilderordner dürfen nur direkt am Gerät geändert werden.' });
      return;
    }
    let saved;
    try { saved = await saveConfig(patch); }
    catch (error) {
      if (!(error instanceof z.ZodError)) throw error;
      res.status(400).json({ error: 'Ungültige Einstellungen.', fields: error.issues.map((issue) => issue.path.join('.')) });
      return;
    }

    // Kalender- und Wetterdaten haengen direkt an der Konfiguration.
    invalidateCalendarCache();
    invalidateWeatherCache();
    invalidateEntityCache();
    invalidateTrashCache();
    invalidateGoogleToken();

    res.json(toPublicConfig(saved));
  }),
);

/* -------------------------------------------------------------------------- */
/* Kalender                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Termine aller aktiven Quellen. `from` und `to` sind optionale ISO-Daten
 * und schraenken das Ergebnis ein; ohne sie gilt das Standardfenster.
 */
api.get(
  '/calendar/events',
  route(async (req, res) => {
    const parse = (value: unknown): Date | undefined => {
      if (typeof value !== 'string' || !value) return undefined;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? undefined : date;
    };

    const from = parse(req.query.from);
    const to = parse(req.query.to);

    res.json(
      await getCalendarEvents(req.query.force === '1', from || to ? { from, to } : undefined),
    );
  }),
);

/** Prüft eine ICS-Adresse und liest Name und Terminanzahl aus dem Feed. */
api.post(
  '/calendar/validate',
  route(async (req, res) => {
    const { url } = (req.body ?? {}) as { url?: string };
    res.json(await validateCalendarUrl(String(url ?? '')));
  }),
);

/**
 * Termin anlegen. Geht immer an Google — eine ICS-Adresse ist eine reine
 * Lese-Adresse und kann grundsätzlich keine Termine aufnehmen.
 */
api.post(
  '/calendar/events',
  route(async (req, res) => {
    const body = (req.body ?? {}) as CreateEventRequest;
    const config = await loadConfig();

    if (!config.google.refreshToken) {
      res.status(409).json({
        ok: false,
        message:
          'Nicht mit Google verbunden. Termine lassen sich nur in einen Google-Kalender ' +
          'schreiben — ICS-Adressen sind reine Lese-Adressen. Einrichtung: docs/google-kalender.md',
      });
      return;
    }

    try {
      const event = await createGoogleEvent(body, config.weather.timezone || 'Europe/Berlin');
      invalidateCalendarCache();
      res.status(201).json({ ok: true, message: 'Termin angelegt', event });
    } catch (error) {
      res.status(400).json({
        ok: false,
        message: describeError(error),
      });
    }
  }),
);

api.post(
  '/calendar/refresh',
  route(async (_req, res) => {
    invalidateCalendarCache();
    res.json(await refreshCalendar());
  }),
);

/* -------------------------------------------------------------------------- */
/* Google Kalender                                                             */
/* -------------------------------------------------------------------------- */

/*
 * Welche Eingabegeraete haengen dran? Entscheidet, ob die Bildschirmtastatur
 * gebraucht wird. Bewusst ohne Zwischenspeicher: Eine Tastatur kann jederzeit
 * ein- oder ausgesteckt werden, und der Aufruf kostet nur zwei readdir.
 */
/*
 * Neustart und Herunterfahren.
 *
 * Die zentrale Zugriffskontrolle und der CSRF-Schutz in app.ts gelten auch
 * für diese Routen. Fremde Formulare dürfen niemals Systemaktionen auslösen.
 */
api.get(
  '/system/power',
  route(async (_req, res) => {
    res.json({ available: await powerAvailable() });
  }),
);

api.post(
  '/system/power/:action',
  route(async (req, res) => {
    const action = req.params.action;
    if (action !== 'reboot' && action !== 'shutdown' && action !== 'exit-kiosk') {
      res.status(400).json({ ok: false, message: 'Unbekannte Aktion.' });
      return;
    }
    const ergebnis = await powerAction(action);
    res.status(ergebnis.ok ? 200 : 403).json(ergebnis);
  }),
);

api.get(
  '/system/input',
  route(async (_req, res) => {
    res.json(await readInputDevices());
  }),
);

api.get(
  '/google/status',
  route(async (_req, res) => {
    res.json({ ...(await googleStatus()), redirectUri: redirectUri() });
  }),
);

api.get(
  '/google/auth-url',
  route(async (_req, res) => {
    try {
      res.json({ url: await buildAuthUrl(), redirectUri: redirectUri() });
    } catch (error) {
      res.status(400).json({ error: describeError(error) });
    }
  }),
);

/**
 * Weiterleitungsziel des Zustimmungsdialogs.
 *
 * Google ruft diese Adresse im Browser des Nutzers auf — die Antwort ist
 * deshalb eine kleine HTML-Seite, keine JSON-Struktur.
 */
api.get(
  '/google/callback',
  route(async (req, res) => {
    const page = (title: string, detail: string, ok: boolean) => `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
 body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
      background:#080808;color:#e4e4e7;font-family:Inter,system-ui,sans-serif}
 .box{max-width:34rem;padding:2.5rem;border:1px solid rgba(255,255,255,.08);border-radius:3px;
      background:linear-gradient(180deg,rgba(22,22,22,.9),rgba(8,8,8,.95));text-align:center}
 h1{font-size:1.25rem;font-weight:500;margin:0 0 .75rem;color:${ok ? '#ff8a52' : '#f43f5e'}}
 p{font-size:.85rem;line-height:1.7;color:#a1a1aa;margin:0}
</style></head><body><div class="box"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p></div></body></html>`;

    const error = req.query.error;
    if (error) {
      res
        .status(400)
        .type('html')
        .send(page('Zugriff abgelehnt', `Google meldet: ${String(error)}`, false));
      return;
    }

    const code = String(req.query.code ?? '');
    if (!code) {
      res.status(400).type('html').send(page('Kein Code erhalten', 'Bitte erneut versuchen.', false));
      return;
    }

    // SICHERHEIT: state muss zum zuletzt selbst ausgestellten passen — sonst
    // koennte ein fremder Autorisierungscode eingeschleust und so ein falsches
    // Google-Konto verbunden werden (Login-CSRF).
    if (!consumeOAuthState(String(req.query.state ?? ''))) {
      res
        .status(400)
        .type('html')
        .send(
          page(
            'Ungültige Anfrage',
            'Der Sicherheits-Code passt nicht oder ist abgelaufen. Bitte den Verbindungsvorgang erneut starten.',
            false,
          ),
        );
      return;
    }

    try {
      const { account } = await exchangeCode(code);
      invalidateCalendarCache();
      res
        .type('html')
        .send(
          page(
            'Google verbunden',
            `${account || 'Konto'} ist verbunden. Dieses Fenster kann geschlossen werden — ` +
              'im Dashboard erscheinen jetzt die Kalender zur Auswahl.',
            true,
          ),
        );
    } catch (cause) {
      res
        .status(400)
        .type('html')
        .send(
          page(
            'Verbindung fehlgeschlagen',
            describeError(cause),
            false,
          ),
        );
    }
  }),
);

api.get(
  '/google/calendars',
  route(async (_req, res) => {
    const config = await loadConfig();
    const inUse = config.calendars
      .map((entry) => entry.googleCalendarId)
      .filter((id): id is string => Boolean(id));

    try {
      res.json({ calendars: await listGoogleCalendars(inUse) });
    } catch (error) {
      res.status(400).json({ error: describeError(error) });
    }
  }),
);

api.post(
  '/google/disconnect',
  route(async (_req, res) => {
    await googleDisconnect();
    invalidateCalendarCache();
    res.json({ ok: true });
  }),
);

/* -------------------------------------------------------------------------- */
/* Muell & Wetter                                                              */
/* -------------------------------------------------------------------------- */

api.get(
  '/trash/next',
  route(async (_req, res) => {
    res.json(await getTrashSchedule());
  }),
);

/** Ortssuche für die Wetter-Einstellungen. */
api.get(
  '/geo/search',
  route(async (req, res) => {
    res.json({ results: await searchPlaces(String(req.query.q ?? '')) });
  }),
);

/** Koordinaten des Browsers in einen Ortsnamen übersetzen. */
api.get(
  '/geo/reverse',
  route(async (req, res) => {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      res.status(400).json({ error: 'lat und lon sind erforderlich' });
      return;
    }
    res.json({ result: await describeCoordinates(latitude, longitude) });
  }),
);

/** ICS-Abfuhrkalender prüfen, bevor er gespeichert wird. */
api.post(
  '/trash/validate',
  route(async (req, res) => {
    const { url } = (req.body ?? {}) as { url?: string };
    res.json(await validateTrashIcs(String(url ?? '')));
  }),
);

api.get(
  '/weather',
  route(async (req, res) => {
    res.json(await getWeather(req.query.force === '1'));
  }),
);

/* -------------------------------------------------------------------------- */
/* Home Assistant                                                              */
/* -------------------------------------------------------------------------- */

api.get(
  '/home-assistant/status',
  route(async (_req, res) => {
    res.json(await getStatus());
  }),
);

/** Entity-Liste für die Auswahl in den Einstellungen. */
api.get(
  '/home-assistant/entities',
  route(async (req, res) => {
    res.json(await listEntities(req.query.force === '1'));
  }),
);

/** Aufbereitete Sensorwerte für das Dashboard. */
api.get(
  '/home-assistant/sensors',
  route(async (_req, res) => {
    res.json({ sensors: await readSensors() });
  }),
);

api.post(
  '/home-assistant/call-service',
  route(async (req, res) => {
    const body = (req.body ?? {}) as HomeAssistantCallRequest;
    const result = await callService(body);
    res.status(result.ok ? 200 : 502).json(result);
  }),
);

/* -------------------------------------------------------------------------- */
/* Bilder für die Diashow                                                      */
/* -------------------------------------------------------------------------- */

/** Alle verfügbaren Bilder samt Auswahlzustand — für die Einstellungen. */
api.get(
  '/photos',
  route(async (_req, res) => {
    res.json(await listPhotos());
  }),
);

/** Nur die ausgewählten Bilder — für die Diashow. */
api.get(
  '/photos/active',
  route(async (_req, res) => {
    res.json({ photos: await activePhotos() });
  }),
);

/**
 * Ein Bild ausliefern.
 *
 * Der Pfad wird gegen den konfigurierten Ordner geprüft; ein Name mit `../`
 * würde sonst beliebige Dateien des Systems zugänglich machen.
 */
api.get(
  '/photos/file/:name',
  route(async (req, res) => {
    const file = await resolvePhotoPath(String(req.params.name));
    if (!file) {
      res.status(404).json({ error: 'Bild nicht gefunden' });
      return;
    }
    // SVG bleibt als Bild nutzbar, darf bei direkter Navigation aber nichts ausführen.
    res.set('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'");
    res.sendFile(file, { maxAge: 0 });
  }),
);

/** Personenmarkierung eines Bilds setzen — rein manuell, fuer die "Person"-Reihenfolge. */
api.patch(
  '/photos/:name/person',
  route(async (req, res) => {
    try {
      const person = String((req.body as { person?: string } | undefined)?.person ?? '');
      await setPhotoPerson(String(req.params.name), person);
      res.json(await listPhotos());
    } catch (error) {
      res.status(400).json({ error: describeError(error) });
    }
  }),
);

/**
 * Bildausschnitt eines Bilds setzen — vom Rahmen-Editor in den Einstellungen.
 * Ohne `focus` im Body (oder `null`) geht es zurueck auf die Bildmitte.
 */
api.patch(
  '/photos/:name/focus',
  route(async (req, res) => {
    try {
      const focus = (req.body as { focus?: { x: number; y: number } | null } | undefined)?.focus;
      await setPhotoFocus(String(req.params.name), focus ?? undefined);
      res.json(await listPhotos());
    } catch (error) {
      res.status(400).json({ error: describeError(error) });
    }
  }),
);

/**
 * Google-Photos-Auswahl.
 *
 * Der Nutzer waehlt Bilder in Googles eigenem Fenster aus; das Dashboard
 * fragt mit der Sitzungs-ID nach, bis die Auswahl steht, und laedt die
 * gewaehlten Bilder danach als eigene Dateien herunter.
 */
api.post(
  '/google/photos/session',
  route(async (_req, res) => {
    try {
      res.json(await startGooglePickerSession());
    } catch (error) {
      res.status(400).json({ error: describeError(error) });
    }
  }),
);

api.get(
  '/google/photos/session/:id',
  route(async (req, res) => {
    try {
      res.json(await googlePickerSessionStatus(String(req.params.id)));
    } catch (error) {
      res.status(400).json({ error: describeError(error) });
    }
  }),
);

api.post(
  '/google/photos/session/:id/import',
  route(async (req, res) => {
    try {
      res.json(await importGooglePickerSession(String(req.params.id)));
    } catch (error) {
      res.status(400).json({ error: describeError(error) });
    }
  }),
);

api.delete(
  '/google/photos/session/:id',
  route(async (req, res) => {
    await cancelGooglePickerSession(String(req.params.id));
    res.json({ ok: true });
  }),
);

/* -------------------------------------------------------------------------- */
/* Timer & Wecker                                                              */
/* -------------------------------------------------------------------------- */

api.get(
  '/timers',
  route(async (_req, res) => {
    res.json(await listTimers());
  }),
);

api.post(
  '/timers',
  route(async (req, res) => {
    try {
      res.status(201).json(await createTimer((req.body ?? {}) as CreateTimerRequest));
    } catch (error) {
      res.status(400).json({ error: describeError(error) });
    }
  }),
);

api.post(
  '/timers/:id/dismiss',
  route(async (req, res) => {
    const entry = await dismissTimer(String(req.params.id));
    if (!entry) {
      res.status(404).json({ error: 'Timer nicht gefunden' });
      return;
    }
    res.json(entry);
  }),
);

api.post(
  '/timers/dismiss-all',
  route(async (_req, res) => {
    res.json({ dismissed: await dismissAllRinging() });
  }),
);

api.delete(
  '/timers/:id',
  route(async (req, res) => {
    const removed = await deleteTimer(String(req.params.id));
    res.status(removed ? 200 : 404).json({ ok: removed });
  }),
);

/* -------------------------------------------------------------------------- */
/* Einkaufsliste & Notizen                                                     */
/* -------------------------------------------------------------------------- */

api.get(
  '/lists',
  route(async (_req, res) => {
    res.json(await getLists());
  }),
);

api.post(
  '/lists/shopping',
  route(async (req, res) => {
    try {
      res.status(201).json(await addShoppingItem((req.body ?? {}) as CreateShoppingItemRequest));
    } catch (error) {
      res.status(400).json({ error: describeError(error) });
    }
  }),
);

// Vor '/lists/shopping/:id' registriert, sonst faengt :id auch "checked" ab.
api.delete(
  '/lists/shopping/checked',
  route(async (_req, res) => {
    res.json({ removed: await clearCheckedShoppingItems() });
  }),
);

api.patch(
  '/lists/shopping/:id/toggle',
  route(async (req, res) => {
    const item = await toggleShoppingItem(String(req.params.id));
    if (!item) {
      res.status(404).json({ error: 'Eintrag nicht gefunden' });
      return;
    }
    res.json(item);
  }),
);

api.delete(
  '/lists/shopping/:id',
  route(async (req, res) => {
    const removed = await deleteShoppingItem(String(req.params.id));
    res.status(removed ? 200 : 404).json({ ok: removed });
  }),
);

api.post(
  '/lists/notes',
  route(async (req, res) => {
    try {
      res.status(201).json(await addNote((req.body ?? {}) as CreateNoteRequest));
    } catch (error) {
      res.status(400).json({ error: describeError(error) });
    }
  }),
);

api.delete(
  '/lists/notes/:id',
  route(async (req, res) => {
    const removed = await deleteNote(String(req.params.id));
    res.status(removed ? 200 : 404).json({ ok: removed });
  }),
);

/* -------------------------------------------------------------------------- */
/* AI                                                                          */
/* -------------------------------------------------------------------------- */

api.post(
  '/ai/chat',
  route(async (req, res) => {
    const body = (req.body ?? {}) as AiChatRequest;
    const result = z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(10000) })).min(1).max(50).safeParse(body.messages);
    if (!result.success) {
      res.status(400).json({ error: 'Ungültiger Gesprächsverlauf.' });
      return;
    }
    res.json(await chat(result.data, body.includeContext !== false));
  }),
);

/**
 * Stellt ein kurzlebiges Token für den Sprachmodus aus. Der Browser baut damit
 * selbst die WebRTC-Verbindung zu OpenAI auf — der API-Key bleibt hier.
 */
api.post(
  '/ai/realtime/session',
  route(async (_req, res) => {
    try {
      res.json(await createRealtimeSession());
    } catch (error) {
      if (error instanceof RealtimeError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  }),
);

/**
 * Öffnet ChatGPT. Der Befehl stammt aus der Konfiguration, nie aus der Anfrage.
 */
api.post(
  '/ai/gpt-live/open',
  route(async (_req, res) => {
    const result = await openGptLive();
    res.status(result.ok ? 200 : 400).json(result);
  }),
);

api.post(
  '/ai/daily-briefing',
  route(async (req, res) => {
    res.json(await dailyBriefing((req.body ?? {}) as DailyBriefingRequest));
  }),
);

/* -------------------------------------------------------------------------- */
/* Verbindungstests fuer die Einstellungen                                     */
/* -------------------------------------------------------------------------- */

api.post(
  '/test/home-assistant',
  route(async (_req, res) => {
    const status = await getStatus();
    res.json({
      ok: status.connected,
      message: status.configured
        ? status.message ?? (status.connected ? 'Verbunden' : 'Keine Verbindung')
        : 'Nicht konfiguriert — Simulationsmodus aktiv',
    });
  }),
);

api.post(
  '/test/ai',
  route(async (_req, res) => {
    res.json(await testAiConnection());
  }),
);

api.post(
  '/test/realtime',
  route(async (_req, res) => {
    res.json(await testRealtime());
  }),
);

api.post(
  '/test/calendar',
  route(async (_req, res) => {
    invalidateCalendarCache();
    const result = await refreshCalendar();
    const failed = result.feeds.filter((feed) => feed.state === 'error');
    res.json({
      ok: failed.length === 0,
      message: failed.length
        ? `${failed.length} Quelle(n) fehlerhaft: ${failed.map((f) => `${f.name} (${f.message})`).join(', ')}`
        : `${result.events.length} Termine aus ${result.feeds.length} Quellen geladen`,
    });
  }),
);

api.post(
  '/test/weather',
  route(async (_req, res) => {
    invalidateWeatherCache();
    const weather = await getWeather(true);
    res.json({
      ok: weather.source === 'open-meteo',
      message:
        weather.source === 'open-meteo'
          ? `${weather.locationName}: ${weather.temperature} °C, ${weather.description}`
          : 'Open-Meteo nicht erreichbar — Demodaten aktiv',
    });
  }),
);

api.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[api]', describeError(error));
  res.status(500).json({ error: 'Interner Fehler' });
});
