import type {
  CalendarEvent,
  CalendarSource,
  CreateEventRequest,
  GoogleCalendarEntry,
  GoogleStatus,
} from '../../../shared/types.ts';
import { fetchWithTimeout, describeError } from '../lib/http.ts';
import { loadConfig, saveConfig } from './config.ts';

/**
 * Google-Calendar-Anbindung über die offizielle API.
 *
 * Gegenüber der ICS-Adresse drei Vorteile: die Daten sind nahezu live statt bis
 * zu 24 Stunden alt, alle Kalender eines Kontos lassen sich auf einmal
 * auflisten, und Google löst Serientermine mit `singleEvents=true` selbst auf —
 * die gesamte RRULE-Behandlung entfällt.
 *
 * Der OAuth-Ablauf ist der Loopback-Flow für Desktop-Clients: Google leitet
 * nach der Zustimmung an 127.0.0.1 zurück, wo dieser Server bereits lauscht.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3';

/**
 * Berechtigungen.
 *
 * `calendar.events` erlaubt das Anlegen von Terminen, `calendar.readonly`
 * zusaetzlich das Auflisten der Kalender des Kontos. Bewusst nicht der volle
 * `calendar`-Bereich: Das Dashboard soll Termine schreiben duerfen, aber keine
 * Kalender anlegen oder loeschen.
 */
const SCOPE = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

/** Muss in der Google Cloud Console als Weiterleitungs-URI eingetragen sein. */
export function redirectUri(): string {
  const port = Number(process.env.PORT ?? 4000);
  return `http://127.0.0.1:${port}/api/google/callback`;
}

/* -------------------------------------------------------------------------- */
/* Zugriffstoken                                                               */
/* -------------------------------------------------------------------------- */

// Zugriffstoken gelten eine Stunde; im Speicher halten statt jedes Mal zu holen.
let accessCache: { token: string; expiresAt: number } | null = null;

export function invalidateGoogleToken(): void {
  accessCache = null;
}

async function getAccessToken(): Promise<string> {
  const config = await loadConfig();
  const { clientId, clientSecret, refreshToken } = config.google;

  if (!clientId || !clientSecret) throw new Error('Client-ID oder Client-Secret fehlt');
  if (!refreshToken) throw new Error('Nicht mit Google verbunden');

  // 60 Sekunden Sicherheitsabstand, damit kein Aufruf mitten im Ablauf landet.
  if (accessCache && accessCache.expiresAt - 60_000 > Date.now()) return accessCache.token;

  const response = await fetchWithTimeout(
    TOKEN_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    },
    12_000,
  );

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };

  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? body.error ?? `HTTP ${response.status}`);
  }

  accessCache = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return accessCache.token;
}

async function apiGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = await getAccessToken();
  const query = new URLSearchParams(params).toString();
  const response = await fetchWithTimeout(
    `${API}${path}${query ? `?${query}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } },
    15_000,
  );

  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
  return body;
}

/* -------------------------------------------------------------------------- */
/* OAuth-Ablauf                                                                */
/* -------------------------------------------------------------------------- */

export async function buildAuthUrl(): Promise<string> {
  const config = await loadConfig();
  if (!config.google.clientId) throw new Error('Client-ID fehlt');

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    // Ohne diese beiden gibt Google kein refresh_token zurück.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });

  return `${AUTH_URL}?${params}`;
}

/** Code aus der Weiterleitung gegen ein refresh_token tauschen. */
export async function exchangeCode(code: string): Promise<{ account: string }> {
  const config = await loadConfig();

  const response = await fetchWithTimeout(
    TOKEN_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code',
      }).toString(),
    },
    15_000,
  );

  const body = (await response.json()) as {
    refresh_token?: string;
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };

  if (!response.ok || !body.refresh_token) {
    throw new Error(
      body.error_description ??
        body.error ??
        'Google hat kein refresh_token geliefert — wurde der Zugriff schon einmal erteilt? ' +
          'Dann unter myaccount.google.com/permissions entziehen und erneut verbinden.',
    );
  }

  accessCache = body.access_token
    ? { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 }
    : null;

  // Kontoname für die Anzeige holen, bevor gespeichert wird.
  let account = '';
  try {
    const list = await apiGet<{ items?: Array<{ id?: string; primary?: boolean }> }>(
      '/users/me/calendarList',
      { maxResults: '50' },
    );
    account = list.items?.find((entry) => entry.primary)?.id ?? '';
  } catch {
    // Der Name ist nur Kosmetik — die Verbindung steht trotzdem.
  }

  await saveConfig({ google: { refreshToken: body.refresh_token, account } });
  return { account };
}

export async function disconnect(): Promise<void> {
  accessCache = null;
  await saveConfig({ google: { refreshToken: '__clear__', account: '' } });
}

export async function getStatus(): Promise<GoogleStatus> {
  const config = await loadConfig();
  const { clientId, clientSecret, refreshToken, account } = config.google;
  const configured = Boolean(clientId && clientSecret);

  if (!configured) {
    return {
      configured: false,
      connected: false,
      account: '',
      message: 'Client-ID und Client-Secret aus der Google Cloud Console eintragen',
    };
  }

  if (!refreshToken) {
    return {
      configured: true,
      connected: false,
      account: '',
      message: 'Noch nicht verbunden',
      authUrl: await buildAuthUrl(),
    };
  }

  try {
    await getAccessToken();
    return { configured: true, connected: true, account };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      account,
      message: describeError(error),
      authUrl: await buildAuthUrl(),
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Kalender und Termine                                                        */
/* -------------------------------------------------------------------------- */

interface CalendarListResponse {
  items?: Array<{
    id?: string;
    summary?: string;
    summaryOverride?: string;
    description?: string;
    backgroundColor?: string;
    primary?: boolean;
    accessRole?: string;
    selected?: boolean;
  }>;
}

export async function listCalendars(inUse: string[]): Promise<GoogleCalendarEntry[]> {
  const data = await apiGet<CalendarListResponse>('/users/me/calendarList', {
    maxResults: '250',
    showHidden: 'false',
  });

  return (data.items ?? [])
    .filter((entry) => entry.id)
    .map((entry) => ({
      id: entry.id as string,
      summary: entry.summaryOverride ?? entry.summary ?? (entry.id as string),
      description: entry.description,
      backgroundColor: entry.backgroundColor,
      primary: entry.primary,
      accessRole: entry.accessRole,
      inUse: inUse.includes(entry.id as string),
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.summary.localeCompare(b.summary, 'de'));
}

/** JSON an die API senden — fuer das Anlegen von Terminen. */
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getAccessToken();
  const response = await fetchWithTimeout(
    `${API}${path}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    15_000,
  );

  const data = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? `HTTP ${response.status}`);
  return data;
}

interface EventsResponse {
  items?: Array<{
    id?: string;
    summary?: string;
    location?: string;
    description?: string;
    status?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  }>;
}

/**
 * Termine eines Kalenders holen.
 *
 * `singleEvents=true` lässt Google die Serien selbst auflösen — inklusive
 * Ausnahmen und verschobener Einzeltermine. Genau die Arbeit, die beim
 * ICS-Weg von Hand nötig ist.
 */
export async function fetchEvents(
  source: CalendarSource,
  from: Date,
  to: Date,
): Promise<CalendarEvent[]> {
  const calendarId = source.googleCalendarId ?? source.url;
  if (!calendarId) return [];

  const data = await apiGet<EventsResponse>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '500',
    },
  );

  return (data.items ?? [])
    .filter((item) => item.status !== 'cancelled' && (item.start?.dateTime || item.start?.date))
    .map((item): CalendarEvent => {
      // Ganztägig liefert Google `date`, sonst `dateTime`.
      const allDay = Boolean(item.start?.date);
      const start = item.start?.dateTime ?? `${item.start?.date}T00:00:00`;
      const end = item.end?.dateTime ?? `${item.end?.date}T00:00:00`;

      return {
        id: `g-${source.id}-${item.id ?? start}`,
        calendarId: source.id,
        calendarName: source.name,
        calendarColor: source.color,
        title: (item.summary ?? 'Ohne Titel').trim(),
        location: item.location?.trim() || undefined,
        description: item.description?.trim().slice(0, 400) || undefined,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        allDay,
      };
    });
}

/* -------------------------------------------------------------------------- */
/* Termine anlegen                                                             */
/* -------------------------------------------------------------------------- */

interface CreatedEvent {
  id?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/**
 * Einen Termin in Google anlegen.
 *
 * Ganztägige Termine tragen `date`, zeitgebundene `dateTime` samt Zeitzone —
 * ohne Zeitzone legt Google den Termin in der Kalenderzeitzone an, was bei
 * einem Panel im Flur regelmäßig um Stunden danebenläge.
 */
export async function createEvent(
  request: CreateEventRequest,
  timezone: string,
): Promise<CalendarEvent> {
  const config = await loadConfig();
  const calendarId = request.calendarId?.trim() || config.google.writeCalendarId || 'primary';

  const title = request.title.trim();
  if (!title) throw new Error('Ein Titel ist erforderlich');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.date)) throw new Error('Ungültiges Datum');

  const body: Record<string, unknown> = { summary: title };
  if (request.location?.trim()) body.location = request.location.trim();

  if (request.allDay) {
    // Google erwartet bei DATE ein exklusives Ende: der Folgetag.
    const next = new Date(`${request.date}T00:00:00`);
    next.setDate(next.getDate() + 1);
    body.start = { date: request.date };
    body.end = { date: next.toISOString().slice(0, 10) };
  } else {
    const from = request.startTime || '09:00';
    const to = request.endTime || addMinutes(from, 60);
    body.start = { dateTime: `${request.date}T${from}:00`, timeZone: timezone };
    body.end = { dateTime: `${request.date}T${to}:00`, timeZone: timezone };
  }

  const created = await apiPost<CreatedEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    body,
  );

  const allDay = Boolean(created.start?.date);
  const start = created.start?.dateTime ?? `${created.start?.date}T00:00:00`;
  const end = created.end?.dateTime ?? `${created.end?.date}T00:00:00`;

  return {
    id: `g-new-${created.id ?? start}`,
    calendarId,
    calendarName: 'Google',
    calendarColor: '#ff7a1a',
    title: created.summary ?? title,
    location: created.location,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    allDay,
  };
}

/** "09:00" plus Minuten, mit Überlauf über Mitternacht. */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = ((h ?? 0) * 60 + (m ?? 0) + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
