import type {
  TransitDeparture,
  TransitJourney,
  TransitMode,
  TransitResponse,
  TransitStopSuggestion,
} from '../../../shared/types.ts';
import { fetchWithTimeout, describeError } from '../lib/http.ts';
import { loadConfig } from './config.ts';

/**
 * Naahverkehr: Abfahrtstafel und die naechste Verbindung zur Arbeit.
 *
 * Quelle ist Transitous, eine frei betriebene MOTIS-Instanz auf den
 * offiziellen DELFI-Fahrplandaten. Kein API-Schluessel, keine Registrierung,
 * kein Konto — dieselbe Ueberlegung wie bei Open-Meteo fuers Wetter. Die
 * Alternative waere db.transport.rest gewesen; die oeffentliche Instanz
 * antwortete beim Bau durchgehend mit 503, und ein Dashboard, das jeden
 * Morgen die Abfahrten zeigen soll, darf nicht an einem fremden
 * Gratis-Endpunkt haengen, der gerade ueberlastet ist.
 */
const BASE = 'https://api.transitous.org/api/v1';

/*
 * Kurzer Cache. Abfahrten veralten in Sekunden, nicht in Minuten — aber das
 * Panel pollt mehrfach je Minute und mehrere Clients teilen sich einen
 * Server. 20 Sekunden halten die Anzeige frisch und den fremden Dienst
 * freundlich belastet.
 */
const CACHE_TTL_MS = 20_000;
const TIMEOUT_MS = 12_000;

/*
 * Ohne Kennung antwortet Transitous mit 403 — Node schickt von sich aus
 * keinen User-Agent, curl schon, weshalb ein Abruf von Hand funktioniert und
 * derselbe aus dem Dienst heraus nicht. Unabhaengig davon gehoert es sich,
 * einem frei betriebenen Dienst gegenueber erkennbar zu sein: Wer auffaellt,
 * soll erreichbar sein.
 */
const USER_AGENT = 'cindralux/1.1.0 (+https://github.com/robsneider23-dotcom/cindralux)';

let cache: { at: number; key: string; data: TransitResponse } | null = null;

/**
 * MOTIS-Verkehrsmittel auf unsere Kennungen.
 *
 * Der Fall `BUS` ist unzuverlaessig: Steht in der Konfiguration die Kennung
 * eines Bussteigs statt der Station, meldet MOTIS auch Regionalzuege als
 * BUS. Deshalb entscheidet zusaetzlich die Liniennummer — "RE50" ist kein
 * Bus, egal was das Feld sagt.
 */
const MODES: Record<string, TransitMode> = {
  BUS: 'bus',
  COACH: 'bus',
  TRAM: 'tram',
  SUBWAY: 'subway',
  METRO: 'subway',
  RAIL: 'regional',
  HIGHSPEED_RAIL: 'longdistance',
  LONG_DISTANCE: 'longdistance',
  NIGHT_RAIL: 'longdistance',
  REGIONAL_RAIL: 'regional',
  REGIONAL_FAST_RAIL: 'regional',
  SUBURBAN_RAIL: 'suburban',
  FERRY: 'ferry',
};

/** Liniennummern, die eine Zuggattung tragen — sie schlagen das Modus-Feld. */
const RAIL_PREFIX = /^(ICE|IC|EC|EN|NJ|RJ|TGV|RE|RB|S|MEX)\s?\d*$/i;

function toMode(raw: string | undefined, line: string): TransitMode {
  const mapped = MODES[String(raw ?? '').toUpperCase()] ?? 'other';
  if (mapped !== 'bus') return mapped;
  const match = RAIL_PREFIX.exec(line.trim());
  if (!match) return 'bus';
  const gattung = match[1]!.toUpperCase();
  if (gattung === 'S') return 'suburban';
  if (['RE', 'RB', 'MEX'].includes(gattung)) return 'regional';
  return 'longdistance';
}

function minutesUntil(iso: string, now: number): number {
  return Math.round((new Date(iso).getTime() - now) / 60_000);
}

function minutesBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);
}

/*
 * DELFI liefert denselben Kurs mehrfach.
 *
 * Mehrere Verbuende melden dieselbe Fahrt an den bundesweiten Datensatz, und
 * MOTIS gibt sie unveraendert weiter — am Straubinger Bahnhof stand der RE50
 * dadurch zweimal in der Liste, einmal 08:51 und einmal 08:52. Fuer den
 * Betrachter ist das ein Fehler, kein zweiter Zug. Zusammengefasst wird nach
 * Linie, Richtung und Abfahrtsminute; eine Minute Toleranz faengt den
 * typischen Versatz zwischen zwei Meldungen ab.
 */
function dedupe(departures: TransitDeparture[]): TransitDeparture[] {
  const seen = new Map<string, TransitDeparture>();
  for (const entry of departures) {
    const minute = Math.floor(new Date(entry.plannedTime).getTime() / 60_000);
    const key = `${entry.line}|${entry.headsign}|${minute}`;
    const nachbar = seen.get(`${entry.line}|${entry.headsign}|${minute - 1}`);
    if (nachbar) {
      // Die Meldung mit Echtzeit gewinnt — sie ist die genauere der beiden.
      if (entry.realtime && !nachbar.realtime) seen.set(`${entry.line}|${entry.headsign}|${minute - 1}`, entry);
      continue;
    }
    const vorhanden = seen.get(key);
    if (vorhanden && !(entry.realtime && !vorhanden.realtime)) continue;
    seen.set(key, entry);
  }
  return [...seen.values()].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  );
}

async function getJson(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetchWithTimeout(
    url.toString(),
    { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } },
    TIMEOUT_MS,
  );
  if (!response.ok) throw new Error(`Nahverkehr antwortete mit ${response.status}`);
  return response.json();
}

interface MotisStopTime {
  place?: { departure?: string; scheduledDeparture?: string; track?: string };
  routeShortName?: string;
  headsign?: string;
  mode?: string;
  cancelled?: boolean;
  realTime?: boolean;
  tripId?: string;
}

function readDepartures(raw: unknown, walkMinutes: number, now: number): TransitDeparture[] {
  const list = (raw as { stopTimes?: MotisStopTime[] })?.stopTimes ?? [];
  const departures: TransitDeparture[] = [];

  for (const entry of list) {
    const place = entry.place ?? {};
    const planned = place.scheduledDeparture ?? place.departure;
    const actual = place.departure ?? place.scheduledDeparture;
    if (!planned || !actual) continue;

    const line = (entry.routeShortName ?? '').trim() || '—';
    const inMinutes = minutesUntil(actual, now);
    // Abgefahrene Kurse interessieren niemanden mehr.
    if (inMinutes < -1) continue;

    departures.push({
      id: `${entry.tripId ?? line}-${planned}`,
      line,
      headsign: (entry.headsign ?? '').trim() || 'Unbekannt',
      mode: toMode(entry.mode, line),
      plannedTime: planned,
      time: actual,
      delayMinutes: minutesBetween(planned, actual),
      realtime: entry.realTime === true,
      inMinutes,
      reachable: inMinutes >= walkMinutes,
      platform: place.track?.trim() || undefined,
      cancelled: entry.cancelled === true,
    });
  }

  return dedupe(departures);
}

interface MotisLeg {
  transitLeg?: boolean;
  routeShortName?: string;
  mode?: string;
}

/** Abschnitte, die man zu Fuss, per Rad oder im eigenen Auto zuruecklegt. */
const SELF_MODES = new Set(['WALK', 'BIKE', 'CAR', 'ODM', 'RENTAL', 'TRANSFER']);

/**
 * Ist dieser Abschnitt eine Fahrt mit einem Verkehrsmittel?
 *
 * `transitLeg` waere das dafuer vorgesehene Feld, aber diese MOTIS-Instanz
 * liefert es gar nicht mit — wer sich darauf verlaesst, zaehlt jede
 * Verbindung als null Fahrten und zeigt eine Verbindung ohne Linien an.
 * Deshalb entscheidet ersatzweise die Fortbewegungsart.
 */
function isRide(leg: MotisLeg): boolean {
  if (leg.transitLeg === true) return true;
  if (leg.transitLeg === false) return false;
  return !SELF_MODES.has(String(leg.mode ?? '').toUpperCase());
}
interface MotisItinerary {
  startTime?: string;
  endTime?: string;
  duration?: number;
  legs?: MotisLeg[];
}

function readJourneys(raw: unknown, walkMinutes: number, now: number): TransitJourney[] {
  const list = (raw as { itineraries?: MotisItinerary[] })?.itineraries ?? [];
  const journeys: TransitJourney[] = [];
  const gesehen = new Set<string>();

  for (const entry of list) {
    if (!entry.startTime || !entry.endTime) continue;
    const transit = (entry.legs ?? []).filter(isRide);
    const lines = transit.map((leg) => (leg.routeShortName ?? '').trim() || '—');

    // Dieselbe Entdopplung wie bei den Abfahrten, nur ueber die ganze Verbindung.
    const minute = Math.floor(new Date(entry.startTime).getTime() / 60_000);
    const key = `${lines.join('>')}|${minute}`;
    if (gesehen.has(key) || gesehen.has(`${lines.join('>')}|${minute - 1}`)) continue;
    gesehen.add(key);

    const inMinutes = minutesUntil(entry.startTime, now);
    journeys.push({
      id: key,
      departure: entry.startTime,
      arrival: entry.endTime,
      durationMinutes: entry.duration
        ? Math.round(entry.duration / 60)
        : minutesBetween(entry.startTime, entry.endTime),
      transfers: Math.max(0, transit.length - 1),
      lines,
      inMinutes,
      reachable: inMinutes >= walkMinutes,
    });
  }

  return journeys.sort(
    (a, b) => new Date(a.departure).getTime() - new Date(b.departure).getTime(),
  );
}

/** Haltestellensuche fuer die Einstellungen. */
export async function searchStops(query: string): Promise<TransitStopSuggestion[]> {
  const text = query.trim();
  if (text.length < 2) return [];

  const raw = await getJson('/geocode', { text });
  const list = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];

  return list
    .filter((entry) => entry.type === 'STOP' && typeof entry.id === 'string')
    .slice(0, 12)
    .map((entry) => ({
      id: String(entry.id),
      name: String(entry.name ?? 'Unbekannt'),
      /*
       * Die Suche ist europaweit und unscharf: Eine Anfrage nach "Straubing"
       * liefert auch "Stübing" in Oesterreich. Ohne Ort danebenzuschreiben
       * waehlt man in den Einstellungen leicht die falsche Haltestelle.
       */
      region:
        [entry.adminLevel3, entry.areas && Array.isArray(entry.areas)
          ? (entry.areas as Record<string, unknown>[]).find((area) => area.matched !== true)?.name
          : undefined]
          .filter(Boolean)
          .map(String)[0] ?? undefined,
    }));
}

function emptyResponse(partial: Partial<TransitResponse>): TransitResponse {
  return {
    configured: false,
    stopName: '',
    destinationName: '',
    departures: [],
    journeys: [],
    stale: false,
    ...partial,
  };
}

export async function getTransit(): Promise<TransitResponse> {
  const config = (await loadConfig()).transit;

  if (!config.enabled || !config.stopId) {
    return emptyResponse({ configured: false, stopName: config.stopName });
  }

  const key = `${config.stopId}|${config.destinationId}|${config.maxDepartures}|${config.walkMinutes}`;
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  const now = Date.now();
  const walk = Math.max(0, config.walkMinutes);

  try {
    /*
     * Beide Abrufe nebeneinander: Der Arbeitsweg ist eine eigene Anfrage, und
     * nacheinander waeren es auf einem Pi ueber schwankendem WLAN schnell
     * mehrere Sekunden, in denen das Panel leer steht.
     */
    const [departureRaw, journeyRaw] = await Promise.all([
      getJson('/stoptimes', {
        stopId: config.stopId,
        n: String(Math.min(30, Math.max(1, config.maxDepartures) * 3)),
        arriveBy: 'false',
      }),
      config.destinationId
        ? getJson('/plan', {
            fromPlace: config.stopId,
            toPlace: config.destinationId,
            numItineraries: '4',
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const data: TransitResponse = {
      configured: true,
      stopName: config.stopName,
      destinationName: config.destinationName,
      departures: readDepartures(departureRaw, walk, now).slice(
        0,
        Math.max(1, config.maxDepartures),
      ),
      journeys: journeyRaw ? readJourneys(journeyRaw, walk, now).slice(0, 3) : [],
      stale: false,
    };

    cache = { at: Date.now(), key, data };
    return data;
  } catch (error) {
    /*
     * Lieber alte Abfahrten mit Hinweis als eine leere Tafel: Wer im Flur
     * steht und aufs Panel schaut, kann mit "vor zwei Minuten galt noch das
     * hier" mehr anfangen als mit einem Fehlertext. Nur wenn nie etwas
     * geladen wurde, bleibt die Liste leer.
     */
    const message = describeError(error);
    if (cache && cache.key === key) {
      const stale = { ...cache.data, stale: true, error: message };
      return stale;
    }
    return emptyResponse({
      configured: true,
      stopName: config.stopName,
      destinationName: config.destinationName,
      stale: true,
      error: message,
    });
  }
}
