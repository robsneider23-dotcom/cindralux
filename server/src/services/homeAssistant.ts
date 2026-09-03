import type {
  HomeAssistantCallRequest,
  HomeAssistantCallResult,
  HomeAssistantEntityList,
  HomeAssistantEntityOption,
  HomeAssistantEntityState,
  HomeAssistantStatus,
  SensorReading,
} from '../../../shared/types.ts';
import { fetchWithTimeout, describeError } from '../lib/http.ts';
import { loadConfig } from './config.ts';
import { getAllCachedStates, getCachedState, isSocketReady } from './homeAssistantSocket.ts';

/**
 * Home-Assistant-Anbindung ueber die REST-API.
 *
 * Ohne baseUrl/token laeuft der Dienst im Mock-Modus: Zustaende werden im
 * Speicher gehalten, damit die Kacheln sich schon jetzt echt anfuehlen. Sobald
 * in den Einstellungen URL und Long-Lived Access Token stehen, gehen dieselben
 * Aufrufe unveraendert an die echte Instanz.
 *
 * ALEXA: bewusst nicht direkt integriert. Der Weg dorthin fuehrt spaeter ueber
 * Home Assistant — Alexa Smart Home Skill, HA-Automationen, Node-RED oder einen
 * Webhook. Dieses Dashboard spricht ausschliesslich mit Home Assistant.
 */

/** Simulierte Entity-Zustaende fuer den Mock-Modus. */
const mockStates = new Map<string, string>();

function mockStateOf(entityId: string): string {
  return mockStates.get(entityId) ?? 'off';
}

/**
 * Beispielhafte Sensorwerte fuer den Simulationsmodus.
 *
 * Sie schwanken leicht mit der Tageszeit, damit das Panel ohne Home Assistant
 * nicht tot wirkt — aber deterministisch, damit nichts flackert.
 */
function mockSensorValue(entityId: string): { state: string; unit?: string; deviceClass?: string } {
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  // Tagesgang: nachts kuehler, nachmittags waermer.
  const daily = Math.sin(((hour + minute / 60 - 6) / 24) * Math.PI * 2);

  if (/temperature|temp/.test(entityId)) {
    const base = /aussen|outdoor|garten/.test(entityId) ? 12 : 21;
    return { state: (base + daily * 3).toFixed(1), unit: '°C', deviceClass: 'temperature' };
  }
  if (/humidity|feuchte/.test(entityId)) {
    return { state: Math.round(48 - daily * 6).toString(), unit: '%', deviceClass: 'humidity' };
  }
  // Solar zuerst pruefen: "sensor.solar_power" wuerde sonst als Verbrauch gelten.
  if (/solar|pv|einspeis/.test(entityId)) {
    const yieldW = hour >= 7 && hour <= 20 ? Math.max(0, Math.round(daily * 2400)) : 0;
    return { state: String(yieldW), unit: 'W', deviceClass: 'power' };
  }
  if (/power|leistung|verbrauch/.test(entityId)) {
    return { state: Math.round(320 + daily * 180).toString(), unit: 'W', deviceClass: 'power' };
  }
  if (/battery|akku/.test(entityId)) {
    return { state: '87', unit: '%', deviceClass: 'battery' };
  }
  if (/window|fenster|door|tuer|tür/.test(entityId)) {
    return { state: mockStates.get(entityId) ?? 'off', deviceClass: 'window' };
  }
  if (/presence|anwesen|person\./.test(entityId)) {
    return { state: mockStates.get(entityId) ?? 'home', deviceClass: 'presence' };
  }
  return { state: mockStates.get(entityId) ?? 'off' };
}

/** Beispiel-Entities, damit die Auswahl auch ohne HA benutzbar ist. */
const MOCK_ENTITIES: HomeAssistantEntityOption[] = [
  { entityId: 'sensor.wohnzimmer_temperature', friendlyName: 'Wohnzimmer Temperatur', domain: 'sensor', state: '21.4', unit: '°C', deviceClass: 'temperature' },
  { entityId: 'sensor.schlafzimmer_temperature', friendlyName: 'Schlafzimmer Temperatur', domain: 'sensor', state: '19.2', unit: '°C', deviceClass: 'temperature' },
  { entityId: 'sensor.aussen_temperature', friendlyName: 'Außentemperatur', domain: 'sensor', state: '12.6', unit: '°C', deviceClass: 'temperature' },
  { entityId: 'sensor.wohnzimmer_humidity', friendlyName: 'Wohnzimmer Luftfeuchte', domain: 'sensor', state: '48', unit: '%', deviceClass: 'humidity' },
  { entityId: 'sensor.hausverbrauch_power', friendlyName: 'Stromverbrauch', domain: 'sensor', state: '412', unit: 'W', deviceClass: 'power' },
  { entityId: 'sensor.solar_power', friendlyName: 'PV-Ertrag', domain: 'sensor', state: '1840', unit: 'W', deviceClass: 'power' },
  { entityId: 'binary_sensor.bad_fenster', friendlyName: 'Badfenster', domain: 'binary_sensor', state: 'off', deviceClass: 'window' },
  { entityId: 'binary_sensor.haustuer', friendlyName: 'Haustür', domain: 'binary_sensor', state: 'off', deviceClass: 'door' },
  { entityId: 'binary_sensor.waschmaschine', friendlyName: 'Waschmaschine läuft', domain: 'binary_sensor', state: 'off', deviceClass: 'running' },
  { entityId: 'person.marcus', friendlyName: 'Marcus', domain: 'person', state: 'home', deviceClass: 'presence' },
  { entityId: 'light.wohnzimmer', friendlyName: 'Wohnzimmer', domain: 'light', state: 'off' },
  { entityId: 'light.kueche', friendlyName: 'Küche', domain: 'light', state: 'off' },
  { entityId: 'climate.wohnzimmer', friendlyName: 'Heizung Wohnzimmer', domain: 'climate', state: 'off' },
  { entityId: 'scene.film_modus', friendlyName: 'Film-Modus', domain: 'scene', state: 'off' },
  { entityId: 'scene.nachtmodus', friendlyName: 'Nachtmodus', domain: 'scene', state: 'off' },
];

async function haFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const config = await loadConfig();
  const base = config.homeAssistant.baseUrl.replace(/\/+$/, '');
  return fetchWithTimeout(
    `${base}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${config.homeAssistant.token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    },
    8_000,
  );
}

export async function isConfigured(): Promise<boolean> {
  const config = await loadConfig();
  return Boolean(config.homeAssistant.baseUrl.trim() && config.homeAssistant.token.trim());
}

/**
 * Zustaende genau der Entities holen, die als Kachel konfiguriert sind.
 *
 * Steht die WebSocket-Verbindung, kommen die Werte aus deren Cache — ohne
 * eigenen HTTP-Request. Fuer Entities, die dort (noch) fehlen, greift der
 * bisherige REST-Weg als Fallback, z.B. kurz nach dem Verbindungsaufbau.
 */
async function fetchTileStates(): Promise<HomeAssistantEntityState[]> {
  const config = await loadConfig();
  const ids = config.smartHomeActions
    .map((action) => action.entityId)
    .filter((id): id is string => Boolean(id) && id !== 'all');

  const states = await Promise.all(
    ids.map(async (entityId): Promise<HomeAssistantEntityState> => {
      const cached = isSocketReady() ? getCachedState(entityId) : undefined;
      if (cached) return { entityId, state: cached.state, friendlyName: cached.friendlyName };

      try {
        const response = await haFetch(`/api/states/${encodeURIComponent(entityId)}`);
        if (!response.ok) return { entityId, state: 'unavailable' };
        const data = (await response.json()) as {
          state?: string;
          attributes?: { friendly_name?: string };
        };
        return {
          entityId,
          state: data.state ?? 'unknown',
          friendlyName: data.attributes?.friendly_name,
        };
      } catch {
        return { entityId, state: 'unavailable' };
      }
    }),
  );

  return states;
}

export async function getStatus(): Promise<HomeAssistantStatus> {
  const configured = await isConfigured();
  const checkedAt = new Date().toISOString();

  if (!configured) {
    const config = await loadConfig();
    return {
      configured: false,
      connected: false,
      mode: 'mock',
      message: 'Nicht konfiguriert — Kacheln laufen im Simulationsmodus',
      entities: config.smartHomeActions
        .filter((action) => action.entityId && action.entityId !== 'all')
        .map((action) => ({
          entityId: action.entityId as string,
          state: mockStateOf(action.entityId as string),
          friendlyName: action.label,
        })),
      checkedAt,
    };
  }

  // Steht die WebSocket-Verbindung schon, ist das der zuverlaessigste Beleg,
  // dass Home Assistant erreichbar ist — der REST-Ping waere nur ein zweiter
  // Weg, dasselbe zu pruefen.
  if (isSocketReady()) {
    return {
      configured: true,
      connected: true,
      mode: 'live',
      message: 'Verbunden (WebSocket)',
      entities: await fetchTileStates(),
      checkedAt,
    };
  }

  try {
    const response = await haFetch('/api/');
    if (!response.ok) {
      throw new Error(response.status === 401 ? 'Token ungültig (401)' : `HTTP ${response.status}`);
    }
    const body = (await response.json()) as { message?: string; version?: string };

    return {
      configured: true,
      connected: true,
      mode: 'live',
      version: body.version,
      message: body.message ?? 'Verbunden',
      entities: await fetchTileStates(),
      checkedAt,
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      mode: 'mock',
      message: describeError(error),
      entities: [],
      checkedAt,
    };
  }
}

export async function callService(
  request: HomeAssistantCallRequest,
): Promise<HomeAssistantCallResult> {
  const { domain, service, entityId, serviceData } = request;

  if (!domain || !service) {
    return { ok: false, mode: 'mock', message: 'domain und service sind erforderlich' };
  }

  if (!(await isConfigured())) {
    // Simulation: Zustand lokal umschalten, damit die UI reagiert.
    if (entityId && entityId !== 'all') {
      const next = service.includes('off') ? 'off' : service === 'toggle'
        ? mockStateOf(entityId) === 'on' ? 'off' : 'on'
        : 'on';
      mockStates.set(entityId, next);
    }
    if (entityId === 'all' && service.includes('off')) {
      for (const key of mockStates.keys()) mockStates.set(key, 'off');
    }

    return {
      ok: true,
      mode: 'mock',
      message: `Simuliert: ${domain}.${service}${entityId ? ` → ${entityId}` : ''}`,
      entity: entityId && entityId !== 'all'
        ? { entityId, state: mockStateOf(entityId) }
        : undefined,
    };
  }

  try {
    const payload: Record<string, unknown> = { ...serviceData };
    // `all` ist kein HA-Entity-Ziel — ohne entity_id wirkt der Call auf die
    // gesamte Domain, was „Alles aus" genau machen soll.
    if (entityId && entityId !== 'all') payload.entity_id = entityId;

    const response = await haFetch(`/api/services/${domain}/${service}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // HA antwortet mit den geaenderten Zustaenden.
    const changed = (await response.json()) as Array<{
      entity_id?: string;
      state?: string;
      attributes?: { friendly_name?: string };
    }>;

    const match = Array.isArray(changed)
      ? changed.find((item) => item.entity_id === entityId) ?? changed[0]
      : undefined;

    return {
      ok: true,
      mode: 'live',
      message: `${domain}.${service} ausgeführt`,
      entity: match?.entity_id
        ? {
            entityId: match.entity_id,
            state: match.state ?? 'unknown',
            friendlyName: match.attributes?.friendly_name,
          }
        : undefined,
    };
  } catch (error) {
    return { ok: false, mode: 'live', message: describeError(error) };
  }
}

/* -------------------------------------------------------------------------- */
/* Entity-Auswahl                                                              */
/* -------------------------------------------------------------------------- */

/** Domains, die fuer Kacheln oder Sensoren ueberhaupt in Frage kommen. */
const RELEVANT_DOMAINS = new Set([
  'sensor',
  'binary_sensor',
  'light',
  'switch',
  'climate',
  'scene',
  'script',
  'cover',
  'lock',
  'media_player',
  'person',
  'device_tracker',
  'fan',
  'input_boolean',
  'vacuum',
]);

interface HaStateResponse {
  entity_id?: string;
  state?: string;
  attributes?: {
    friendly_name?: string;
    unit_of_measurement?: string;
    device_class?: string;
  };
}

/** Cache der Entity-Liste — eine HA-Installation hat schnell hunderte davon. */
let entityCache: { at: number; data: HomeAssistantEntityList } | null = null;
const ENTITY_TTL_MS = 60_000;

/**
 * Alle relevanten Entities auflisten, damit man in den Einstellungen auswaehlen
 * statt tippen kann. Ohne HA-Verbindung kommt eine Beispielliste zurueck.
 */
export async function listEntities(force = false): Promise<HomeAssistantEntityList> {
  if (!force && entityCache && Date.now() - entityCache.at < ENTITY_TTL_MS) {
    return entityCache.data;
  }

  if (!(await isConfigured())) {
    const data: HomeAssistantEntityList = {
      mode: 'mock',
      entities: MOCK_ENTITIES,
      message: 'Nicht mit Home Assistant verbunden — Beispielauswahl',
    };
    entityCache = { at: Date.now(), data };
    return data;
  }

  // Der WebSocket-Cache traegt bereits den kompletten Bestand — kein
  // zusaetzlicher /api/states-Request noetig.
  if (isSocketReady()) {
    const entities = getAllCachedStates()
      .filter((entry) => RELEVANT_DOMAINS.has(entry.entityId.split('.')[0] ?? ''))
      .map(
        (entry): HomeAssistantEntityOption => ({
          entityId: entry.entityId,
          friendlyName: entry.friendlyName ?? entry.entityId,
          domain: entry.entityId.split('.')[0] ?? '',
          state: entry.state,
          unit: entry.unit,
          deviceClass: entry.deviceClass,
        }),
      )
      .sort((a, b) => a.friendlyName.localeCompare(b.friendlyName, 'de'));

    const data: HomeAssistantEntityList = { mode: 'live', entities };
    entityCache = { at: Date.now(), data };
    return data;
  }

  try {
    const response = await haFetch('/api/states');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const states = (await response.json()) as HaStateResponse[];

    const entities = states
      .filter((item) => {
        const domain = item.entity_id?.split('.')[0];
        return domain ? RELEVANT_DOMAINS.has(domain) : false;
      })
      .map((item): HomeAssistantEntityOption => {
        const entityId = item.entity_id as string;
        return {
          entityId,
          friendlyName: item.attributes?.friendly_name ?? entityId,
          domain: entityId.split('.')[0] ?? '',
          state: item.state ?? 'unknown',
          unit: item.attributes?.unit_of_measurement,
          deviceClass: item.attributes?.device_class,
        };
      })
      .sort((a, b) => a.friendlyName.localeCompare(b.friendlyName, 'de'));

    const data: HomeAssistantEntityList = { mode: 'live', entities };
    entityCache = { at: Date.now(), data };
    return data;
  } catch (error) {
    return {
      mode: 'mock',
      entities: MOCK_ENTITIES,
      message: `Home Assistant nicht erreichbar (${describeError(error)}) — Beispielauswahl`,
    };
  }
}

export function invalidateEntityCache(): void {
  entityCache = null;
}

/* -------------------------------------------------------------------------- */
/* Sensorwerte                                                                 */
/* -------------------------------------------------------------------------- */

/** Zustaende, die ohne eigene Angabe als Warnung gelten. */
const DEFAULT_ALERT_STATES = ['on', 'open', 'unlocked', 'detected', 'wet'];

/** Binaere Zustaende lesbar machen, statt "on"/"off" anzuzeigen. */
function humanizeState(state: string, deviceClass?: string): string {
  const map: Record<string, [string, string]> = {
    window: ['offen', 'zu'],
    door: ['offen', 'zu'],
    garage_door: ['offen', 'zu'],
    opening: ['offen', 'zu'],
    lock: ['offen', 'verriegelt'],
    motion: ['Bewegung', 'ruhig'],
    moisture: ['nass', 'trocken'],
    running: ['läuft', 'aus'],
    presence: ['zuhause', 'unterwegs'],
    battery: ['schwach', 'ok'],
  };

  const pair = deviceClass ? map[deviceClass] : undefined;
  if (pair) return state === 'on' ? pair[0] : pair[1];

  if (state === 'home') return 'zuhause';
  if (state === 'not_home') return 'unterwegs';
  if (state === 'on') return 'an';
  if (state === 'off') return 'aus';
  if (state === 'unavailable' || state === 'unknown') return '—';
  return state;
}

/** Konfigurierte Sensoren lesen und fuer die Anzeige aufbereiten. */
export async function readSensors(): Promise<SensorReading[]> {
  const config = await loadConfig();
  const active = config.sensors.filter((sensor) => sensor.enabled && sensor.entityId.trim());
  if (active.length === 0) return [];

  const live = await isConfigured();

  return Promise.all(
    active.map(async (sensor): Promise<SensorReading> => {
      let state = 'unavailable';
      let unit = sensor.unit;
      let deviceClass: string | undefined;

      if (live) {
        const cached = isSocketReady() ? getCachedState(sensor.entityId) : undefined;
        if (cached) {
          state = cached.state;
          unit = sensor.unit ?? cached.unit;
          deviceClass = cached.deviceClass;
        } else {
          try {
            const response = await haFetch(`/api/states/${encodeURIComponent(sensor.entityId)}`);
            if (response.ok) {
              const data = (await response.json()) as HaStateResponse;
              state = data.state ?? 'unknown';
              unit = sensor.unit ?? data.attributes?.unit_of_measurement;
              deviceClass = data.attributes?.device_class;
            }
          } catch {
            // Ein einzelner nicht erreichbarer Sensor darf den Rest nicht kippen.
          }
        }
      } else {
        const mock = mockSensorValue(sensor.entityId);
        state = mock.state;
        unit = sensor.unit ?? mock.unit;
        deviceClass = mock.deviceClass;
      }

      const available = state !== 'unavailable' && state !== 'unknown';
      const numeric = Number(state);
      const isNumber = available && state.trim() !== '' && Number.isFinite(numeric);

      const display = !available
        ? '—'
        : isNumber
          ? `${numeric.toFixed(sensor.decimals ?? (Number.isInteger(numeric) ? 0 : 1))}${unit ? ` ${unit}` : ''}`
          : humanizeState(state, deviceClass);

      const alertStates = sensor.alertStates?.length ? sensor.alertStates : DEFAULT_ALERT_STATES;

      return {
        id: sensor.id,
        label: sensor.label,
        entityId: sensor.entityId,
        icon: sensor.icon,
        display,
        raw: state,
        unit,
        alert: available && alertStates.includes(state),
        available,
      };
    }),
  );
}
