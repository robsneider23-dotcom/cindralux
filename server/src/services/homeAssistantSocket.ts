import { describeError } from '../lib/http.ts';
import { loadConfig, onConfigChanged } from './config.ts';

/**
 * Home-Assistant-Zustaende ueber die native WebSocket-API statt Polling.
 *
 * Bisher fragte jede Anzeige (Kacheln, Sensoren, Entity-Liste) bei jedem
 * Client-Poll einzeln per REST bei Home Assistant an — bei zehn Kacheln zehn
 * HTTP-Requests alle 20 Sekunden, nur um zu sehen, ob sich etwas geaendert
 * hat. Stattdessen haelt dieser Dienst eine einzige, dauerhafte
 * WebSocket-Verbindung: einmal alle Zustaende laden, danach nur noch die
 * tatsaechlichen Aenderungen (`state_changed`-Events) entgegennehmen und
 * einen lokalen Cache pflegen. `homeAssistant.ts` liest daraus, statt selbst
 * zu fragen — Fallback auf die bisherige REST-Logik bleibt bestehen, falls
 * die Verbindung gerade fehlt.
 *
 * Protokoll: https://developers.home-assistant.io/docs/api/websocket
 */

export interface CachedHaState {
  entityId: string;
  state: string;
  friendlyName?: string;
  unit?: string;
  deviceClass?: string;
}

interface HaEventMessage {
  type: 'auth_required' | 'auth_ok' | 'auth_invalid' | 'result' | 'event' | 'pong';
  success?: boolean;
  event?: {
    event_type?: string;
    data?: {
      entity_id?: string;
      new_state?: {
        state?: string;
        attributes?: { friendly_name?: string; unit_of_measurement?: string; device_class?: string };
      } | null;
    };
  };
  result?: Array<{
    entity_id?: string;
    state?: string;
    attributes?: { friendly_name?: string; unit_of_measurement?: string; device_class?: string };
  }>;
}

const cache = new Map<string, CachedHaState>();

let socket: WebSocket | null = null;
let messageId = 1;
let connected = false;
/** Erst true, sobald der erste vollstaendige get_states-Snapshot da ist. */
let primed = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelayMs = 2_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
/** baseUrl+token, fuer die gerade verbunden/verbindend wird — erkennt Aenderungen. */
let connectingFor = '';

function toWebSocketUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = url.pathname.replace(/\/+$/, '') + '/api/websocket';
  return url.toString();
}

interface RawHaState {
  state?: string;
  attributes?: { friendly_name?: string; unit_of_measurement?: string; device_class?: string };
}

function applyState(entityId: string, state: RawHaState | null | undefined): void {
  if (!state) {
    cache.delete(entityId);
    return;
  }
  cache.set(entityId, {
    entityId,
    state: state.state ?? 'unknown',
    friendlyName: state.attributes?.friendly_name,
    unit: state.attributes?.unit_of_measurement,
    deviceClass: state.attributes?.device_class,
  });
}

function scheduleReconnect(forKey: string): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (connectingFor === forKey) void connect();
  }, reconnectDelayMs);
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
}

async function connect(): Promise<void> {
  const config = await loadConfig();
  const { baseUrl, token } = config.homeAssistant;
  const key = `${baseUrl}::${token}`;
  connectingFor = key;

  if (!baseUrl.trim() || !token.trim()) {
    // Nicht konfiguriert: Cache leeren, homeAssistant.ts faellt auf Mock zurueck.
    connected = false;
    primed = false;
    cache.clear();
    return;
  }

  let ws: WebSocket;
  try {
    ws = new WebSocket(toWebSocketUrl(baseUrl));
  } catch (error) {
    console.warn(`[ha-socket] Verbindung nicht aufbaubar: ${describeError(error)}`);
    scheduleReconnect(key);
    return;
  }

  socket = ws;

  ws.addEventListener('message', (event) => {
    if (connectingFor !== key) return; // ueberholt durch neuere Config
    let message: HaEventMessage;
    try {
      message = JSON.parse(String(event.data)) as HaEventMessage;
    } catch {
      return;
    }

    if (message.type === 'auth_required') {
      ws.send(JSON.stringify({ type: 'auth', access_token: token }));
      return;
    }

    if (message.type === 'auth_invalid') {
      console.warn('[ha-socket] Token abgelehnt (auth_invalid)');
      ws.close();
      return;
    }

    if (message.type === 'auth_ok') {
      connected = true;
      reconnectDelayMs = 2_000;
      const snapshotId = messageId++;
      const subscribeId = messageId++;
      ws.send(JSON.stringify({ id: snapshotId, type: 'get_states' }));
      ws.send(JSON.stringify({ id: subscribeId, type: 'subscribe_events', event_type: 'state_changed' }));
      return;
    }

    if (message.type === 'result' && Array.isArray(message.result)) {
      // Antwort auf get_states: kompletten Bestand einmalig uebernehmen.
      cache.clear();
      for (const entry of message.result) {
        if (!entry.entity_id) continue;
        applyState(entry.entity_id, { state: entry.state, attributes: entry.attributes });
      }
      primed = true;
      return;
    }

    if (message.type === 'event' && message.event?.event_type === 'state_changed') {
      const entityId = message.event.data?.entity_id;
      if (entityId) applyState(entityId, message.event.data?.new_state ?? null);
    }
  });

  ws.addEventListener('close', () => {
    if (connectingFor !== key) return;
    connected = false;
    primed = false;
    socket = null;
    scheduleReconnect(key);
  });

  ws.addEventListener('error', () => {
    // 'close' folgt auf 'error' und uebernimmt den Reconnect — hier nur stumm bleiben.
  });
}

/** Beim Serverstart aufrufen. */
export function startHomeAssistantSocket(): void {
  void connect();
  onConfigChanged(() => {
    void reconnectIfNeeded();
  });
}

/** Nach einer moeglichen Konfigurationsaenderung: nur neu verbinden, wenn sich baseUrl/token geaendert haben. */
async function reconnectIfNeeded(): Promise<void> {
  const config = await loadConfig();
  const key = `${config.homeAssistant.baseUrl}::${config.homeAssistant.token}`;
  if (key === connectingFor && (connected || reconnectTimer)) return;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectDelayMs = 2_000;
  socket?.close();
  socket = null;
  connected = false;
  primed = false;
  await connect();
}

/** True, sobald die Verbindung steht UND der erste vollstaendige Zustandsabruf da ist. */
export function isSocketReady(): boolean {
  return connected && primed;
}

export function getCachedState(entityId: string): CachedHaState | undefined {
  return cache.get(entityId);
}

export function getAllCachedStates(): CachedHaState[] {
  return [...cache.values()];
}
