/**
 * Gemeinsames Datenmodell fuer Client und Server.
 *
 * WICHTIG: Diese Datei enthaelt ausschliesslich Typen — keine Runtime-Werte.
 * Dadurch werden alle `import type`-Verweise beim Transpilieren entfernt und
 * weder Vite noch tsx muessen /shared aufloesen oder buendeln.
 */

/* -------------------------------------------------------------------------- */
/* Kalender                                                                    */
/* -------------------------------------------------------------------------- */

/** Eine abonnierte ICS/iCal-Quelle. */
export interface CalendarSource {
  id: string;
  name: string;
  /** Hex-Farbe, kennzeichnet alle Events dieser Quelle in der UI. */
  color: string;
  /** Leer lassen, solange nur Seed-Daten genutzt werden. */
  url: string;
  enabled: boolean;
  /**
   * Konto, zu dem der Kalender gehoert — z.B. "marcus@gmail.com".
   * Dient der Gruppierung in den Einstellungen; mehrere Konten sind moeglich.
   */
  account?: string;
  /** Woher der Kalender stammt. Steuert die Hinweise in der Oberflaeche. */
  provider?: 'ics' | 'google' | 'google-api';
  /**
   * Kalender-ID bei Google, wenn provider === 'google-api'.
   * Dann wird nicht die ICS-Adresse benutzt, sondern die Calendar-API.
   */
  googleCalendarId?: string;
}

/**
 * Zugang zur Google-Calendar-API.
 *
 * Gegenueber der ICS-Adresse: nahezu live statt bis zu 24 Stunden Verzoegerung,
 * alle Kalender eines Kontos auf einmal, und Google loest Serientermine selbst
 * auf (`singleEvents=true`).
 */
export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  /** Langlebiges Token aus dem OAuth-Austausch. */
  refreshToken: string;
  /** Konto, mit dem verbunden wurde — nur zur Anzeige. */
  account: string;
  /**
   * Kalender, in den neue Termine geschrieben werden.
   * `primary` ist der Hauptkalender des verbundenen Kontos.
   */
  writeCalendarId: string;
}

/** Neuer Termin, im Dashboard angelegt. */
export interface CreateEventRequest {
  title: string;
  /** YYYY-MM-DD. */
  date: string;
  /** HH:MM — entfaellt bei ganztaegigen Terminen. */
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  location?: string;
  /** Zielkalender; ohne Angabe der eingestellte Schreibkalender. */
  calendarId?: string;
}

export interface CreateEventResult {
  ok: boolean;
  message: string;
  /** Angelegter Termin, wie Google ihn zurueckgibt. */
  event?: CalendarEvent;
}

/** Ein Kalender aus der Kalenderliste des verbundenen Kontos. */
export interface GoogleCalendarEntry {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole?: string;
  /** Bereits als Quelle im Dashboard eingetragen. */
  inUse: boolean;
}

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  account: string;
  message?: string;
  /** Adresse fuer den Zustimmungsdialog; nur wenn noch nicht verbunden. */
  authUrl?: string;
}

/**
 * Kalenderquelle, wie der Client sie sieht.
 *
 * Die ICS-Adresse verlaesst den Server nie: Sie ist bei Google eine
 * Geheimadresse, mit der jeder den Kalender lesen kann. Der Client erfaehrt
 * nur, DASS eine hinterlegt ist, plus einen ungefaehrlichen Wiedererkennungs-
 * Hinweis (Host und Dateiname, ohne das Token im Pfad).
 */
export type PublicCalendarSource = Omit<CalendarSource, 'url'> & {
  hasUrl: boolean;
  /** z.B. "calendar.google.com/…/basic.ics" — enthaelt nie das Geheimnis. */
  urlHint?: string;
};

/** Ergebnis der Pruefung einer ICS-Adresse beim Hinzufuegen. */
export interface CalendarValidation {
  ok: boolean;
  /** Aus dem Feed gelesener Kalendername (X-WR-CALNAME). */
  name?: string;
  /** Anzahl Termine im Feed — belegt, dass wirklich Daten ankommen. */
  eventCount?: number;
  timezone?: string;
  /** Erkannter Anbieter, damit die Oberflaeche passend beschriften kann. */
  provider?: 'ics' | 'google';
  /** Klartext-Fehler oder Hinweis, wenn die Adresse nicht taugt. */
  message: string;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
  title: string;
  location?: string;
  description?: string;
  /** ISO-8601 mit Zeitzonen-Offset. Bei allDay: Tagesbeginn lokal. */
  start: string;
  end: string;
  allDay: boolean;
}

export interface CalendarFeedStatus {
  calendarId: string;
  name: string;
  /** `seed` = Demodaten, weil keine URL hinterlegt ist. */
  /** `stale` = Abruf fehlgeschlagen, es wird der letzte Cache gezeigt. */
  state: 'ok' | 'error' | 'seed' | 'disabled' | 'stale';
  eventCount: number;
  message?: string;
  fetchedAt?: string;
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
  feeds: CalendarFeedStatus[];
  /** Zeitpunkt des letzten echten Abrufs. */
  refreshedAt: string;
  /** true, sobald mindestens eine Quelle aus Seed-Daten stammt. */
  usesSeedData: boolean;
}

/* -------------------------------------------------------------------------- */
/* Muellabholung                                                               */
/* -------------------------------------------------------------------------- */

export type TrashKind = 'restmuell' | 'bio' | 'papier' | 'gelber-sack' | 'glas' | 'sperrmuell';

/** Woher die Abfuhrtermine stammen. */
export type TrashSourceKind = 'rules' | 'ics';

export interface TrashConfig {
  source: TrashSourceKind;
  /** ICS-Adresse des Entsorgers, z.B. der Abfuhrkalender der Kommune. */
  icsUrl: string;
  /**
   * Hochgeladene ICS-Datei als Text. Greift, wenn source = 'ics' und keine
   * URL gesetzt ist — fuer Entsorger, die nur einen Download anbieten.
   */
  icsContent: string;
  /** Dateiname der hochgeladenen Datei, nur zur Anzeige. */
  icsFileName: string;
}

/** Wiederkehrende Abfuhrregel, z.B. "Bio, jeden Dienstag". */
export interface TrashRule {
  id: string;
  kind: TrashKind;
  label: string;
  color: string;
  /** 0 = Sonntag … 6 = Samstag. */
  weekday: number;
  /** 1 = woechentlich, 2 = 14-taegig, 4 = vierwoechentlich. */
  everyNWeeks: number;
  /** Ankerdatum (YYYY-MM-DD) fuer den Rhythmus mehrwoechiger Regeln. */
  anchorDate: string;
  enabled: boolean;
}

export interface TrashPickup {
  id: string;
  kind: TrashKind;
  label: string;
  color: string;
  /** YYYY-MM-DD. */
  date: string;
  /** 0 = heute, 1 = morgen. */
  daysUntil: number;
  isToday: boolean;
  isTomorrow: boolean;
}

export interface TrashResponse {
  /** Die naechste faellige Abholung, oder null wenn keine Regel aktiv ist. */
  next: TrashPickup | null;
  /** Alle Abholungen der kommenden Wochen, aufsteigend sortiert. */
  upcoming: TrashPickup[];
  source: 'rules' | 'ics' | 'none';
  /** Hinweis, wenn die ICS-Quelle nicht gelesen werden konnte. */
  message?: string;
}

/* -------------------------------------------------------------------------- */
/* Wetter                                                                      */
/* -------------------------------------------------------------------------- */

export type WeatherIcon =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunder';

export interface WeatherDay {
  /** YYYY-MM-DD. */
  date: string;
  min: number;
  max: number;
  icon: WeatherIcon;
  description: string;
  precipitationChance: number;
  /** Niederschlagsmenge in mm. */
  precipitationSum?: number;
  /** Hoechster UV-Index des Tages. */
  uvIndexMax?: number;
  /** Windspitze in km/h. */
  windGusts?: number;
  /** ISO-Zeitpunkte. */
  sunrise?: string;
  sunset?: string;
}

/** Ein Stundenwert fuer den Tagesverlauf im Detailfenster. */
export interface WeatherHour {
  /** ISO-Zeitpunkt. */
  time: string;
  temperature: number;
  apparent: number;
  precipitationChance: number;
  windSpeed: number;
  icon: WeatherIcon;
}

/** Zusatzwerte, die nur im Detailfenster gezeigt werden. */
export interface WeatherDetails {
  /** Luftdruck auf Meereshoehe in hPa. */
  pressure: number;
  /** Bewoelkung in Prozent. */
  cloudCover: number;
  /** Windrichtung in Grad, 0 = Nord. */
  windDirection: number;
  /** Windspitzen in km/h. */
  windGusts: number;
  /** Aktueller Niederschlag in mm. */
  precipitation: number;
  uvIndexMax: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherSummary {
  locationName: string;
  temperature: number;
  apparentTemperature: number;
  description: string;
  icon: WeatherIcon;
  high: number;
  low: number;
  windSpeed: number;
  humidity: number;
  precipitationChance: number;
  isDay: boolean;
  forecast: WeatherDay[];
  /** Stundenverlauf ab jetzt, fuer das Detailfenster. */
  hourly: WeatherHour[];
  details: WeatherDetails;
  updatedAt: string;
  /** `open-meteo` = live abgerufen, `seed` = Demodaten. */
  source: 'open-meteo' | 'seed';
}

/* -------------------------------------------------------------------------- */
/* Home Assistant / Smart Home                                                 */
/* -------------------------------------------------------------------------- */

export type SmartHomeIcon =
  | 'power-off'
  | 'lamp'
  | 'kitchen'
  | 'movie'
  | 'night'
  | 'blinds'
  | 'heating'
  | 'music'
  | 'coffee'
  | 'lock';

/** Eine Kachel im Smart-Home-Dock; beschreibt zugleich den HA-Service-Call. */
export interface HomeAssistantAction {
  id: string;
  label: string;
  /** Kurzer Zusatz unter dem Label, z.B. "3 Lampen". */
  hint?: string;
  icon: SmartHomeIcon;
  /** `toggle` zeigt einen An/Aus-Zustand, `scene` ist ein einmaliger Ausloeser. */
  kind: 'toggle' | 'scene';
  domain: string;
  service: string;
  /** Gegenstueck fuer den Aus-Zustand einer Toggle-Kachel. */
  serviceOff?: string;
  entityId?: string;
  serviceData?: Record<string, unknown>;
  /** Optionale Akzentfarbe; ohne Angabe gilt Ember. */
  accent?: string;
}

export interface HomeAssistantEntityState {
  entityId: string;
  state: string;
  friendlyName?: string;
  /** Einheit aus den HA-Attributen, z.B. "°C" oder "%". */
  unit?: string;
  /** HA-Geraeteklasse, z.B. "temperature", "humidity", "door". */
  deviceClass?: string;
}

/** Eintrag der Entity-Auswahl in den Einstellungen. */
export interface HomeAssistantEntityOption {
  entityId: string;
  friendlyName: string;
  domain: string;
  state: string;
  unit?: string;
  deviceClass?: string;
}

export interface HomeAssistantEntityList {
  /** `mock` = keine HA-Verbindung, die Liste zeigt Beispiel-Entities. */
  mode: 'live' | 'mock';
  entities: HomeAssistantEntityOption[];
  message?: string;
}

export type SensorIcon =
  | 'temperature'
  | 'humidity'
  | 'window'
  | 'door'
  | 'power'
  | 'solar'
  | 'battery'
  | 'motion'
  | 'water'
  | 'washer'
  | 'presence'
  | 'generic';

/** Ein auf dem Dashboard angezeigter Messwert oder Zustand. */
export interface HomeAssistantSensor {
  id: string;
  label: string;
  entityId: string;
  icon: SensorIcon;
  /** Ueberschreibt die Einheit aus Home Assistant. */
  unit?: string;
  /** Nachkommastellen fuer Zahlenwerte. */
  decimals?: number;
  /**
   * Zustaende, die als Warnung gelten — z.B. ["on", "open"] fuer ein
   * Fenster. Der Wert wird dann farblich hervorgehoben.
   */
  alertStates?: string[];
  enabled: boolean;
}

/** Aufbereiteter Sensorwert fuer die Anzeige. */
export interface SensorReading {
  id: string;
  label: string;
  entityId: string;
  icon: SensorIcon;
  /** Fertig formatierter Wert inklusive Einheit. */
  display: string;
  /** Rohwert, falls die UI ihn braucht. */
  raw: string;
  unit?: string;
  alert: boolean;
  available: boolean;
}

export interface HomeAssistantStatus {
  configured: boolean;
  connected: boolean;
  /** `mock` = keine HA-Konfiguration, Zustaende werden lokal simuliert. */
  mode: 'live' | 'mock';
  version?: string;
  message?: string;
  entities: HomeAssistantEntityState[];
  checkedAt: string;
}

export interface HomeAssistantCallRequest {
  domain: string;
  service: string;
  entityId?: string;
  serviceData?: Record<string, unknown>;
}

export interface HomeAssistantCallResult {
  ok: boolean;
  mode: 'live' | 'mock';
  message: string;
  /** Zustand nach dem Aufruf, sofern ermittelbar. */
  entity?: HomeAssistantEntityState;
}

/* -------------------------------------------------------------------------- */
/* AI-Assistent                                                                */
/* -------------------------------------------------------------------------- */

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatRequest {
  messages: AiMessage[];
  /** Bindet Kalender, Wetter und Muell als Kontext ein. */
  includeContext?: boolean;
}

export interface AiChatResponse {
  message: AiMessage;
  /** `mock` = kein API-Key gesetzt. */
  mode: 'live' | 'mock';
  model?: string;
  message_error?: string;
}

export interface DailyBriefingRequest {
  /** ISO-Datum; ohne Angabe gilt heute. */
  date?: string;
  tone?: 'kurz' | 'ausfuehrlich';
}

/* -------------------------------------------------------------------------- */
/* Konfiguration                                                               */
/* -------------------------------------------------------------------------- */

export interface WeatherConfig {
  locationName: string;
  latitude: number;
  longitude: number;
  /** IANA-Zeitzone, z.B. "Europe/Berlin". */
  timezone: string;
}

export interface HomeAssistantConfig {
  baseUrl: string;
  /** Long-Lived Access Token. Wird nach aussen nur maskiert ausgeliefert. */
  token: string;
}

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Vorangestellte Persona fuer alle Anfragen. */
  systemPrompt: string;
  realtime: RealtimeConfig;
  gptLive: GptLiveConfig;
}

/** Welche Ansicht der AI-Bereich zeigt. */
export type AiMode = 'assistant' | 'gpt-live';

/**
 * Verknuepfung zu ChatGPT im Browser.
 *
 * ChatGPT wird bewusst NICHT eingebettet: chatgpt.com setzt
 * `frame-ancestors`/X-Frame-Options, ein iframe wird vom Browser blockiert.
 * Stattdessen wird die Seite in einem eigenen Fenster geoeffnet.
 */
export interface GptLiveConfig {
  enabled: boolean;
  url: string;
  /**
   * `browser-tab` oeffnet ein neues Browserfenster aus der Seite heraus.
   * `local-command` laesst den Server einen Befehl auf dem Geraet starten —
   * im Kiosk-Modus der zuverlaessigere Weg, weil dort Popups oft im selben
   * Vollbildfenster landen.
   */
  mode: 'browser-tab' | 'local-command';
  /** Befehl fuer `local-command`, z.B. `brave --app=https://chatgpt.com`. */
  command: string;
}

/** Antwort auf POST /api/ai/gpt-live/open. */
export interface GptLiveOpenResult {
  ok: boolean;
  message: string;
  /** Bei `browser-tab` oeffnet der Client selbst; der Server bestaetigt nur. */
  handledBy: 'client' | 'server';
  url: string;
}

/**
 * Sprachmodus ueber die OpenAI Realtime API (Sprache rein, Sprache raus).
 *
 * Die Endpunkte stehen bewusst in der Konfiguration: OpenAI hat die Realtime-API
 * zwischen Beta und GA umgestellt, und so laesst sich eine Aenderung ohne
 * Codeaenderung nachziehen.
 */
export interface RealtimeConfig {
  enabled: boolean;
  model: string;
  /** Stimme, z.B. "alloy", "verse", "marin". */
  voice: string;
  /** Endpunkt, der kurzlebige Client-Tokens ausstellt. */
  sessionUrl: string;
  /** Endpunkt fuer den WebRTC-SDP-Austausch. */
  callUrl: string;
  /** Modell fuer die Transkription der eigenen Sprache. */
  transcriptionModel: string;
}

/** Werkzeug, das der Sprachassistent aufrufen darf. */
export interface RealtimeTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Antwort auf POST /api/ai/realtime/session. Enthaelt nie den echten API-Key. */
export interface RealtimeSessionResponse {
  /** Kurzlebiges Token — gilt nur wenige Minuten und nur fuer diese Sitzung. */
  clientSecret: string;
  expiresAt: number;
  model: string;
  voice: string;
  callUrl: string;
  transcriptionModel: string;
  /**
   * Welche Variante der Realtime-API das Token ausgestellt hat. GA und Beta
   * erwarten unterschiedlich aufgebaute `session.update`-Nachrichten.
   */
  variant: 'ga' | 'beta';
  /**
   * Persona samt aktuellem Haushalts-Kontext. Der Client schickt den Text nach
   * dem Verbinden per `session.update` — das ist der Weg, der unabhaengig von
   * der Token-Variante zuverlaessig greift.
   */
  instructions: string;
  /** Funktionen, die der Assistent per Sprache auslösen darf. */
  tools: RealtimeTool[];
}

export type ThemeMode = 'ember' | 'crimson' | 'graphite';

/**
 * Nachtabsenkung. Ein Panel im Flur, das nachts voll leuchtet, ist nach einer
 * Woche eine Zumutung — deshalb zeitgesteuert abdunkeln.
 *
 * HINWEIS: Die echte Hintergrundbeleuchtung laesst sich aus dem Browser nicht
 * steuern. Die Absenkung ist eine Abdunklung im Bild. Fuer echtes Ausschalten
 * braucht es auf dem Pi DPMS oder `vcgencmd display_power` — siehe README.
 */
export interface NightModeConfig {
  enabled: boolean;
  /** Stunde 0–23, ab der abgesenkt wird. */
  startHour: number;
  /** Stunde 0–23, ab der wieder normal angezeigt wird. */
  endHour: number;
  /** Restliche Helligkeit, 0.05–1. */
  dimLevel: number;
  /** Statt des Dashboards nur Uhr, Datum und dringende Hinweise zeigen. */
  clockOnly: boolean;
  /** Sekunden, die eine Berührung das Panel wieder voll aufweckt. */
  wakeSeconds: number;
}

/** Fenster, die eine eigene Hintergrundbewegung tragen koennen. */
export type WindowId =
  | 'agenda'
  | 'calendar'
  | 'weather'
  | 'trash'
  | 'smarthome'
  | 'sensors'
  | 'assistant'
  | 'timer'
  | 'lists'
  | 'settings';

/** Verfuegbare Hintergrundbewegungen. */
export type BackdropStyle =
  | 'none'
  | 'timeline'
  | 'grid'
  | 'drift'
  | 'breathe'
  | 'pulse'
  | 'sweep'
  | 'orbit'
  | 'ring'
  | 'rain'
  | 'embers';

export interface AppearanceConfig {
  themeMode: ThemeMode;
  /** Dateiname unter /assets/cindralux, z.B. "backdrop-topo.svg". */
  background: string;
  /** Deckkraft des Hintergrunds, 0–1. */
  backgroundOpacity: number;
  showSeconds: boolean;
  /** Ruhige Bewegungen abschalten (z.B. fuer schwache Pi-Hardware). */
  reducedMotion: boolean;
  night: NightModeConfig;
  /** Hintergrundbewegung je Fenster. */
  windowBackdrops: Record<WindowId, BackdropStyle>;
  /**
   * Einbrennschutz: verschiebt die Oberflaeche langsam um wenige Pixel.
   * Ein statisches Bild rund um die Uhr brennt sich in viele Displays ein.
   */
  burnInProtection: boolean;
  /**
   * Bildschirmtastatur. "auto" blendet sie nur ein, wenn das System keine
   * echte Tastatur meldet — auf einem Touchpanel also immer, am Schreibtisch
   * mit angeschlossener Tastatur nie.
   */
  onScreenKeyboard: OnScreenKeyboardMode;
  /** Helles oder dunkles Design. */
  colorScheme: ColorScheme;
}

export type OnScreenKeyboardMode = 'off' | 'auto' | 'always';

/**
 * Helles oder dunkles Design. "auto" folgt dem Nachtfenster: tagsueber hell,
 * nachts dunkel — fuer ein Panel an der Wand die sinnvollste Vorgabe.
 */
export type ColorScheme = 'dark' | 'light' | 'auto';

/** Was das System an Eingabegeraeten sieht. Der Browser kann das nicht. */
export interface InputDevices {
  /** Mindestens eine echte Tastatur angeschlossen. */
  physicalKeyboard: boolean;
  /** Mindestens ein Touchscreen erkannt. */
  touchScreen: boolean;
  /** Namen der erkannten Geraete, fuer die Diagnose in den Einstellungen. */
  devices: string[];
}

/** Ansichten des Kalenderbereichs. */
export type CalendarView = 'tag' | 'woche' | 'monat';

export interface CalendarViewConfig {
  /** Ansicht, zu der nach Inaktivitaet zurueckgekehrt wird. */
  defaultView: CalendarView;
  /**
   * Minuten ohne Bedienung, nach denen die Ansicht zurueckspringt.
   * 0 schaltet die Rueckkehr ab.
   */
  autoReturnMinutes: number;
}

export interface AppConfig {
  calendars: CalendarSource[];
  trashRules: TrashRule[];
  trash: TrashConfig;
  calendarView: CalendarViewConfig;
  weather: WeatherConfig;
  homeAssistant: HomeAssistantConfig;
  google: GoogleConfig;
  ai: AiConfig;
  smartHomeActions: HomeAssistantAction[];
  sensors: HomeAssistantSensor[];
  appearance: AppearanceConfig;
  idle: IdleConfig;
  photos: PhotosConfig;
  /** Aktualisierungsintervall des Kalender-Caches in Minuten. */
  calendarRefreshMinutes: number;
}

/**
 * Konfiguration, wie sie der Client sieht: Geheimnisse sind maskiert.
 * `hasToken` / `hasApiKey` sagen, ob ein Wert hinterlegt ist.
 */
export type PublicAppConfig = Omit<
  AppConfig,
  'homeAssistant' | 'ai' | 'google' | 'calendars' | 'trash'
> & {
  calendars: PublicCalendarSource[];
  /** Die ICS-Adresse des Entsorgers ist zwar selten geheim, wird aber gleich behandelt. */
  trash: Omit<TrashConfig, 'icsUrl' | 'icsContent'> & {
    hasIcsUrl: boolean;
    icsUrlHint?: string;
    hasIcsContent: boolean;
  };
  homeAssistant: Omit<HomeAssistantConfig, 'token'> & { hasToken: boolean };
  ai: Omit<AiConfig, 'apiKey'> & { hasApiKey: boolean };
  google: Omit<GoogleConfig, 'clientSecret' | 'refreshToken'> & {
    hasClientSecret: boolean;
    connected: boolean;
  };
};

/**
 * Patch fuer PUT /api/config. Alle Felder optional; Secrets werden nur
 * ueberschrieben, wenn sie tatsaechlich mitgeschickt werden.
 */
export type AppConfigPatch = {
  [K in keyof AppConfig]?: AppConfig[K] extends Array<infer _T>
    ? AppConfig[K]
    : Partial<AppConfig[K]>;
};

/* -------------------------------------------------------------------------- */
/* System / Health                                                             */
/* -------------------------------------------------------------------------- */

export interface HealthResponse {
  ok: true;
  service: 'cindralux-home-command-center';
  version: string;
  uptimeSeconds: number;
  /** Platzhalter fuer den spaeteren Pi-Systemstatus. */
  system: {
    hostname: string;
    platform: string;
    loadAverage: number;
    memoryUsedPercent: number;
    /** Auf dem Pi spaeter aus /sys/class/thermal befuellt. */
    temperatureC: number | null;
  };
  time: string;
}

export interface ApiError {
  error: string;
  detail?: string;
}

/* -------------------------------------------------------------------------- */
/* Timer & Wecker                                                              */
/* -------------------------------------------------------------------------- */

export type TimerKind = 'timer' | 'alarm';

export interface AppTimer {
  id: string;
  kind: TimerKind;
  /** Beschriftung, z.B. "Nudeln" oder "Aufstehen". */
  label: string;
  /** ISO-Zeitpunkt, zu dem der Timer klingelt. */
  dueAt: string;
  /** Ursprüngliche Laufzeit in Sekunden — nur bei kind === 'timer'. */
  durationSeconds?: number;
  /** Wecker: an diesen Wochentagen wiederholen (0 = Sonntag). Leer = einmalig. */
  repeatWeekdays?: number[];
  createdAt: string;
  /** Läuft gerade ab und wartet auf Bestätigung. */
  ringing: boolean;
  enabled: boolean;
}

export interface CreateTimerRequest {
  kind: TimerKind;
  label?: string;
  /** Für Timer: Laufzeit in Sekunden. */
  seconds?: number;
  /** Für Wecker: "HH:MM" in lokaler Zeit. */
  time?: string;
  repeatWeekdays?: number[];
}

export interface TimerListResponse {
  timers: AppTimer[];
  serverTime: string;
}

/* -------------------------------------------------------------------------- */
/* Einkaufsliste & Notizen                                                     */
/* -------------------------------------------------------------------------- */

export interface ShoppingItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

export interface NoteItem {
  id: string;
  text: string;
  createdAt: string;
}

export interface ListsResponse {
  shopping: ShoppingItem[];
  notes: NoteItem[];
}

export interface CreateShoppingItemRequest {
  text: string;
}

export interface CreateNoteRequest {
  text: string;
}

/* -------------------------------------------------------------------------- */
/* Standortsuche                                                               */
/* -------------------------------------------------------------------------- */

/** Treffer der Ortssuche (Open-Meteo Geocoding). */
export interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  /** Bundesland oder Region, zur Unterscheidung gleichnamiger Orte. */
  admin?: string;
  timezone: string;
  population?: number;
}

/* -------------------------------------------------------------------------- */
/* Ruhemodus und Diashow                                                       */
/* -------------------------------------------------------------------------- */

/** Uebergangseffekt zwischen zwei Bildern. */
export type SlideTransition =
  | 'fade'
  | 'fade-zoom'
  | 'ken-burns'
  | 'blur-fade'
  | 'glow-dissolve'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'push-left'
  | 'push-up'
  | 'wipe-left'
  | 'wipe-right'
  | 'wipe-up'
  | 'wipe-diagonal'
  | 'wipe-circle'
  | 'blinds-vertical'
  | 'blinds-horizontal'
  | 'shutter'
  | 'scanline';

/** Woher die Bilder der Diashow stammen. */
export type PhotoSource = 'local' | 'google' | 'both';

/**
 * Reihenfolge der Diashow.
 *
 * `mix` mischt einmal pro Sitzung zufaellig, `date` sortiert nach
 * Aufnahme-/Dateidatum, `person` gruppiert nach der manuell vergebenen
 * Personenmarkierung (unmarkierte Bilder laufen zuletzt).
 */
export type SlideshowOrder = 'mix' | 'date' | 'person';

export interface SlideshowConfig {
  enabled: boolean;
  /** Sekunden je Bild. */
  intervalSeconds: number;
  transition: SlideTransition;
  /** Bei jedem Wechsel einen zufaelligen Effekt nehmen. */
  randomTransition: boolean;
  source: PhotoSource;
  order: SlideshowOrder;
}

export interface IdleConfig {
  enabled: boolean;
  /** Sekunden ohne Bedienung, bis der Ruhemodus beginnt. */
  afterSeconds: number;
  showClock: boolean;
  showWeather: boolean;
  showAgenda: boolean;
  slideshow: SlideshowConfig;
}

/** Ein Bild, das die Diashow zeigen kann. */
export interface PhotoItem {
  id: string;
  /** Dateiname oder Titel — nur zur Anzeige. */
  name: string;
  /** Adresse zum Laden, immer ueber den eigenen Server. */
  url: string;
  origin: 'local' | 'google';
  /** Vom Nutzer zur Anzeige ausgewaehlt. */
  selected: boolean;
  width?: number;
  height?: number;
  /** ISO-Zeitstempel — bei Google das Aufnahmedatum, sonst das Dateidatum. */
  takenAt?: string;
  /** Manuell vergebene Personenmarkierung, fuer die "Person"-Reihenfolge. */
  person?: string;
}

export interface PhotoLibrary {
  photos: PhotoItem[];
  /** Verzeichnis, aus dem lokale Bilder stammen. */
  localDir: string;
  message?: string;
}

export interface PhotosConfig {
  /** Verzeichnis mit lokalen Bildern, relativ zum Projekt oder absolut. */
  localDir: string;
  /** IDs der Bilder, die gezeigt werden. Leer = alle. */
  selected: string[];
}

/**
 * Google-Photos-Picker-Sitzung: Der Nutzer waehlt Bilder in Googles eigenem
 * Fenster (`pickerUri`) aus; das Dashboard fragt mit `sessionId` nach, bis
 * die Auswahl steht, und laedt die gewaehlten Bilder danach lokal herunter.
 */
export interface GooglePickerSession {
  sessionId: string;
  pickerUri: string;
  pollIntervalMs: number;
}

export interface GooglePickerStatus {
  ready: boolean;
  pollIntervalMs: number;
}
