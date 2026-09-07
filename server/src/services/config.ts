import type {
  AppConfig,
  AppConfigPatch,
  CalendarSource,
  PublicAppConfig,
} from '../../../shared/types.ts';
import { urlHint, registerSecrets } from '../lib/redact.ts';
import { CONFIG_FILE, DATA_DIR } from '../lib/paths.ts';
import { validateConfigPatch } from '../lib/configValidation.ts';
import { chmod, stat } from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { ensureDir, readJson, writeJson } from '../lib/jsonStore.ts';

/**
 * Auslieferungszustand. Die Kalender haben absichtlich keine URL: ohne URL
 * liefert der Kalenderdienst realistische Seed-Daten, damit das Dashboard
 * sofort lebendig aussieht.
 */
export const DEFAULT_CONFIG: AppConfig = {
  calendars: [
    { id: 'familie', name: 'Familie', color: '#ff5a1f', url: '', enabled: true },
    { id: 'arbeit', name: 'Arbeit', color: '#22d3ee', url: '', enabled: true },
    { id: 'privat', name: 'Privat', color: '#a78bfa', url: '', enabled: true },
    { id: 'sport', name: 'Sport & Termine', color: '#34d399', url: '', enabled: true },
  ],
  trashRules: [
    {
      id: 'restmuell',
      kind: 'restmuell',
      label: 'Restmüll',
      color: '#a1a1aa',
      weekday: 3,
      everyNWeeks: 2,
      anchorDate: '2026-01-07',
      enabled: true,
    },
    {
      id: 'bio',
      kind: 'bio',
      label: 'Biotonne',
      color: '#84cc16',
      weekday: 2,
      everyNWeeks: 1,
      anchorDate: '2026-01-06',
      enabled: true,
    },
    {
      id: 'papier',
      kind: 'papier',
      label: 'Papier',
      color: '#38bdf8',
      weekday: 5,
      everyNWeeks: 4,
      anchorDate: '2026-01-09',
      enabled: true,
    },
    {
      id: 'gelber-sack',
      kind: 'gelber-sack',
      label: 'Gelber Sack',
      color: '#fbbf24',
      weekday: 1,
      everyNWeeks: 2,
      anchorDate: '2026-01-05',
      enabled: true,
    },
  ],
  trash: {
    // Regeln als Standard: sie funktionieren ohne Internet und ohne dass man
    // erst die Adresse seines Entsorgers heraussuchen muss.
    source: 'rules',
    icsUrl: '',
    icsContent: '',
    icsFileName: '',
  },
  calendarView: {
    defaultView: 'woche',
    autoReturnMinutes: 5,
  },
  weather: {
    locationName: 'Berlin',
    latitude: 52.52,
    longitude: 13.405,
    timezone: 'Europe/Berlin',
  },
  homeAssistant: {
    baseUrl: '',
    token: '',
  },
  google: {
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    account: '',
    writeCalendarId: 'primary',
  },
  ai: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    systemPrompt:
      'Du bist CINDRALUX, der Assistent eines persönlichen Home Command Centers. ' +
      'Antworte auf Deutsch, sachlich, knapp und ohne Floskeln. ' +
      'Der Text erscheint auf einem Touchscreen aus 1–2 Metern Entfernung: ' +
      'kurze Sätze, maximal fünf Zeilen, keine Markdown-Überschriften.',
    realtime: {
      enabled: true,
      model: 'gpt-realtime',
      voice: 'marin',
      sessionUrl: 'https://api.openai.com/v1/realtime/client_secrets',
      callUrl: 'https://api.openai.com/v1/realtime/calls',
      transcriptionModel: 'gpt-4o-transcribe',
    },
    gptLive: {
      enabled: true,
      url: 'https://chatgpt.com',
      // Standard ist der Browserweg: er funktioniert ohne jede Einrichtung.
      // Im Kiosk-Betrieb ist 'local-command' der zuverlaessigere Weg.
      mode: 'browser-tab',
      command: 'brave --app=https://chatgpt.com',
    },
  },
  smartHomeActions: [
    {
      id: 'alles-aus',
      label: 'Alles aus',
      hint: 'Ganze Wohnung',
      icon: 'power-off',
      kind: 'scene',
      domain: 'light',
      service: 'turn_off',
      entityId: 'all',
      accent: '#ff3c12',
    },
    {
      id: 'wohnzimmer-licht',
      label: 'Wohnzimmer',
      hint: '3 Lampen',
      icon: 'lamp',
      kind: 'toggle',
      domain: 'light',
      service: 'turn_on',
      serviceOff: 'turn_off',
      entityId: 'light.wohnzimmer',
      accent: '#ff5a1f',
    },
    {
      id: 'kueche-licht',
      label: 'Küche',
      hint: 'Deckenlicht',
      icon: 'kitchen',
      kind: 'toggle',
      domain: 'light',
      service: 'turn_on',
      serviceOff: 'turn_off',
      entityId: 'light.kueche',
      accent: '#fbbf24',
    },
    {
      id: 'film-modus',
      label: 'Film-Modus',
      hint: 'Licht dimmen',
      icon: 'movie',
      kind: 'scene',
      domain: 'scene',
      service: 'turn_on',
      entityId: 'scene.film_modus',
      accent: '#a78bfa',
    },
    {
      id: 'nachtmodus',
      label: 'Nachtmodus',
      hint: 'Alles sichern',
      icon: 'night',
      kind: 'scene',
      domain: 'scene',
      service: 'turn_on',
      entityId: 'scene.nachtmodus',
      accent: '#22d3ee',
    },
    {
      id: 'heizung',
      label: 'Heizung',
      hint: '21 °C Komfort',
      icon: 'heating',
      kind: 'toggle',
      domain: 'climate',
      service: 'turn_on',
      serviceOff: 'turn_off',
      entityId: 'climate.wohnzimmer',
      accent: '#f97316',
    },
  ],
  sensors: [
    {
      id: 'temp-wohnzimmer',
      label: 'Wohnzimmer',
      entityId: 'sensor.wohnzimmer_temperature',
      icon: 'temperature',
      decimals: 1,
      enabled: true,
    },
    {
      id: 'temp-aussen',
      label: 'Außen',
      entityId: 'sensor.aussen_temperature',
      icon: 'temperature',
      decimals: 1,
      enabled: true,
    },
    {
      id: 'humidity-wohnzimmer',
      label: 'Luftfeuchte',
      entityId: 'sensor.wohnzimmer_humidity',
      icon: 'humidity',
      decimals: 0,
      enabled: true,
    },
    {
      id: 'fenster-bad',
      label: 'Badfenster',
      entityId: 'binary_sensor.bad_fenster',
      icon: 'window',
      alertStates: ['on', 'open'],
      enabled: true,
    },
    {
      id: 'haustuer',
      label: 'Haustür',
      entityId: 'binary_sensor.haustuer',
      icon: 'door',
      alertStates: ['on', 'open', 'unlocked'],
      // Standardmaessig aus: fuenf Werte passen bei 1024px noch lesbar nebeneinander.
      enabled: false,
    },
    {
      id: 'strom',
      label: 'Verbrauch',
      entityId: 'sensor.hausverbrauch_power',
      icon: 'power',
      decimals: 0,
      enabled: true,
    },
    {
      id: 'solar',
      label: 'PV-Ertrag',
      entityId: 'sensor.solar_power',
      icon: 'solar',
      decimals: 0,
      enabled: false,
    },
  ],
  /**
   * Anordnung des Rasters. Die Vorlagen selbst stehen im Client
   * (client/src/lib/layouts.ts) — nur er zeichnet sie. Hier steht bloss,
   * welche gilt, und die eigene Anordnung, falls der Nutzer eine gebaut hat.
   * `custom` ist mit der Standardvorlage vorbelegt: Wer auf "Eigene"
   * umschaltet, faengt bei etwas Brauchbarem an statt bei einem leeren Raster.
   */
  layout: {
    preset: 'standard',
    custom: [
      { span: 3, panels: ['agenda', 'trash'] },
      { span: 6, panels: ['calendar'] },
      { span: 3, panels: ['weather'] },
    ],
  },
  idle: {
    enabled: true,
    // Zwei Minuten: lang genug, dass es beim Bedienen nicht stoert.
    afterSeconds: 120,
    showClock: true,
    showWeather: true,
    showAgenda: true,
    slideshow: {
      enabled: true,
      intervalSeconds: 20,
      transition: 'ken-burns',
      randomTransition: false,
      source: 'local',
      order: 'mix',
    },
  },
  photos: {
    localDir: 'data/photos',
    selected: [],
  },
  appearance: {
    themeMode: 'ember',
    customAccent: '#7c9eff',
    fontPairing: 'standard',
    background: 'backdrop-topo.svg',
    backgroundOpacity: 0.5,
    showSeconds: true,
    reducedMotion: false,
    windowBackdrops: {
      agenda: 'timeline',
      calendar: 'grid',
      weather: 'drift',
      trash: 'breathe',
      smarthome: 'pulse',
      sensors: 'sweep',
      assistant: 'orbit',
      timer: 'ring',
      lists: 'grid',
      settings: 'none',
    },
    night: {
      enabled: true,
      startHour: 22,
      endHour: 6,
      dimLevel: 0.25,
      clockOnly: false,
      wakeSeconds: 45,
    },
    burnInProtection: true,
    onScreenKeyboard: 'auto',
    colorScheme: 'dark',
  },
  calendarRefreshMinutes: 15,
};

let cached: AppConfig | null = null;
function protectSecrets(config: AppConfig): void {
  registerSecrets([config.ai.apiKey, config.homeAssistant.token, config.google.clientSecret,
    config.google.refreshToken, config.trash.icsUrl, ...config.calendars.map((entry) => entry.url)]);
}

/**
 * Aenderungen an data/config.json von Hand uebernehmen.
 *
 * Die Datei ist ausdruecklich zum Editieren gedacht — ohne Beobachtung wuerde
 * der Server bis zum Neustart mit dem alten Stand weiterarbeiten und der
 * Nutzer raetselt, warum seine Aenderung nichts bewirkt.
 */
let watcher: FSWatcher | null = null;
const changeListeners = new Set<() => void>();

/** Wird nach einer erkannten Aenderung aufgerufen, z.B. um Caches zu leeren. */
export function onConfigChanged(listener: () => void): void {
  changeListeners.add(listener);
}

function watchConfigFile(): void {
  if (watcher) return;

  const configFileName = path.basename(CONFIG_FILE);

  try {
    // Das Verzeichnis beobachten statt der Datei selbst: jsonStore.writeJson()
    // schreibt atomar per temporaerer Datei + rename (Stromausfallschutz), und
    // ein auf die Datei selbst gesetzter Watcher haengt danach am alten Inode
    // — er wuerde die naechste Aenderung nie mehr sehen. Ein Verzeichnis-Watcher
    // bleibt davon unberuehrt und wird stattdessen auf den Dateinamen gefiltert.
    //
    // Kurze Sammelfrist: Editoren schreiben oft mehrfach hintereinander.
    let timer: NodeJS.Timeout | undefined;
    watcher = watch(DATA_DIR, { persistent: false }, (_event, filename) => {
      if (filename && filename !== configFileName) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        console.log('[config] data/config.json wurde geändert — wird neu gelesen.');
        cached = null;
        for (const listener of changeListeners) listener();
      }, 250);
    });
    watcher.on('error', () => {
      // Ein fehlgeschlagener Watcher darf den Server nicht stoppen.
      watcher = null;
    });
  } catch {
    // Auf Systemen ohne Dateibeobachtung laeuft alles wie bisher weiter.
  }
}

/** Fehlende Felder aus den Defaults auffuellen — alte config.json bleibt lesbar. */
function merge(base: AppConfig, patch: Partial<AppConfig> | null): AppConfig {
  if (!patch) return structuredClone(base);
  return {
    calendars: patch.calendars ?? base.calendars,
    trashRules: patch.trashRules ?? base.trashRules,
    trash: { ...base.trash, ...patch.trash },
    calendarView: { ...base.calendarView, ...patch.calendarView },
    weather: { ...base.weather, ...patch.weather },
    homeAssistant: { ...base.homeAssistant, ...patch.homeAssistant },
    google: { ...base.google, ...patch.google },
    ai: {
      ...base.ai,
      ...patch.ai,
      realtime: { ...base.ai.realtime, ...patch.ai?.realtime },
      gptLive: { ...base.ai.gptLive, ...patch.ai?.gptLive },
    },
    smartHomeActions: patch.smartHomeActions ?? base.smartHomeActions,
    sensors: patch.sensors ?? base.sensors,
    idle: {
      ...base.idle,
      ...patch.idle,
      slideshow: { ...base.idle.slideshow, ...patch.idle?.slideshow },
    },
    photos: { ...base.photos, ...patch.photos },
    layout: {
      ...base.layout,
      ...patch.layout,
      // Die eigene Anordnung ist eine Liste — die wird ersetzt, nicht
      // verschmolzen. Sonst blieben geloeschte Spalten stehen.
      custom: patch.layout?.custom ?? base.layout.custom,
    },
    appearance: {
      ...base.appearance,
      ...patch.appearance,
      night: { ...base.appearance.night, ...patch.appearance?.night },
      windowBackdrops: {
        ...base.appearance.windowBackdrops,
        ...patch.appearance?.windowBackdrops,
      },
    },
    calendarRefreshMinutes: patch.calendarRefreshMinutes ?? base.calendarRefreshMinutes,
  };
}

/**
 * Umgebungsvariablen gewinnen gegen die Datei. So laesst sich der Pi spaeter
 * per systemd-Unit konfigurieren, ohne Secrets in data/config.json zu legen.
 */
function applyEnv(config: AppConfig): AppConfig {
  const env = process.env;
  const next = structuredClone(config);
  if (env.HA_BASE_URL) next.homeAssistant.baseUrl = env.HA_BASE_URL;
  if (env.HA_TOKEN) next.homeAssistant.token = env.HA_TOKEN;
  if (env.AI_BASE_URL) next.ai.baseUrl = env.AI_BASE_URL;
  if (env.AI_API_KEY) next.ai.apiKey = env.AI_API_KEY;
  if (env.AI_MODEL) next.ai.model = env.AI_MODEL;
  return next;
}

export async function loadConfig(): Promise<AppConfig> {
  if (cached) return cached;
  await ensureDir(DATA_DIR);
  const stored = await readJson<Partial<AppConfig>>(CONFIG_FILE);
  if (!stored) {
    await writeJson(CONFIG_FILE, DEFAULT_CONFIG);
    console.log('[config] data/config.json mit Standardwerten angelegt.');
  }
  // chmod erzeugt selbst Watch-Ereignisse, auch bei unverändertem Modus.
  // Nur tatsächlich nötige Korrekturen vornehmen, sonst lädt der Watcher endlos neu.
  if (((await stat(CONFIG_FILE)).mode & 0o777) !== 0o600) await chmod(CONFIG_FILE, 0o600);
  cached = applyEnv(merge(DEFAULT_CONFIG, stored));
  protectSecrets(cached);
  watchConfigFile();
  return cached;
}

let saveQueue: Promise<unknown> = Promise.resolve();
export function saveConfig(patch: AppConfigPatch): Promise<AppConfig> {
  const saved = saveQueue.then(() => persistConfig(patch));
  saveQueue = saved.catch(() => undefined);
  return saved;
}
async function persistConfig(patch: AppConfigPatch): Promise<AppConfig> {
  const current = await loadConfig();
  const safePatch = validateConfigPatch(patch, DEFAULT_CONFIG) as Partial<AppConfig>;
  const next = merge(current, safePatch);

  // Ein leerer String im Patch bedeutet "unveraendert lassen", nicht "loeschen".
  // Zum Loeschen schickt der Client den Sentinel-Wert "__clear__".
  // Kalenderadressen wie Geheimnisse behandeln: Der Client kennt sie nicht und
  // schickt sie deshalb leer zurueck — das darf sie nicht loeschen.
  next.calendars = mergeCalendars(current.calendars, next.calendars);
  next.trash.icsUrl = resolveSecret(current.trash.icsUrl, safePatch.trash?.icsUrl);
  next.trash.icsContent = resolveSecret(current.trash.icsContent, safePatch.trash?.icsContent);

  next.homeAssistant.token = resolveSecret(current.homeAssistant.token, safePatch.homeAssistant?.token);
  next.ai.apiKey = resolveSecret(current.ai.apiKey, safePatch.ai?.apiKey);
  next.google.clientSecret = resolveSecret(current.google.clientSecret, safePatch.google?.clientSecret);
  next.google.refreshToken = resolveSecret(current.google.refreshToken, safePatch.google?.refreshToken);

  await writeJson(CONFIG_FILE, next);
  cached = next;
  protectSecrets(next);
  return next;
}

export const CLEAR_SECRET = '__clear__';

/**
 * Eingehende Kalenderliste mit den gespeicherten Adressen zusammenfuehren.
 *
 * Der Client bekommt die Adressen nie zu sehen und schickt sie folglich leer
 * zurueck. Eine leere Adresse bedeutet deshalb "unveraendert lassen"; nur der
 * Sentinel `__clear__` loescht sie wirklich.
 */
function mergeCalendars(current: CalendarSource[], incoming: CalendarSource[]): CalendarSource[] {
  const known = new Map(current.map((entry) => [entry.id, entry]));

  return incoming.map((entry) => {
    const previous = known.get(entry.id);
    return { ...entry, url: resolveSecret(previous?.url ?? '', entry.url) };
  });
}

function resolveSecret(current: string, incoming: string | undefined): string {
  if (incoming === undefined || incoming === '') return current;
  if (incoming === CLEAR_SECRET) return '';
  return incoming;
}

/** Fuer die Auslieferung an den Client: Secrets raus, nur Ja/Nein bleibt. */
export function toPublicConfig(config: AppConfig): PublicAppConfig {
  const { homeAssistant, ai, google, calendars, trash, ...rest } = config;
  return {
    ...structuredClone(rest),
    // Die ICS-Adresse ist bei Google eine Geheimadresse — sie verlaesst den
    // Server nie. Der Client bekommt nur einen Wiedererkennungs-Hinweis.
    calendars: calendars.map((entry) => {
      const { url, ...withoutUrl } = entry;
      return { ...withoutUrl, hasUrl: url.trim().length > 0, urlHint: urlHint(url) };
    }),
    trash: {
      source: trash.source,
      icsFileName: trash.icsFileName,
      hasIcsUrl: trash.icsUrl.trim().length > 0,
      icsUrlHint: urlHint(trash.icsUrl),
      hasIcsContent: trash.icsContent.trim().length > 0,
    },
    homeAssistant: {
      baseUrl: homeAssistant.baseUrl,
      hasToken: homeAssistant.token.length > 0,
    },
    google: {
      clientId: google.clientId,
      account: google.account,
      writeCalendarId: google.writeCalendarId,
      hasClientSecret: google.clientSecret.length > 0,
      connected: google.refreshToken.length > 0,
    },
    ai: {
      baseUrl: ai.baseUrl,
      model: ai.model,
      systemPrompt: ai.systemPrompt,
      realtime: ai.realtime,
      gptLive: ai.gptLive,
      hasApiKey: ai.apiKey.length > 0,
    },
  };
}
