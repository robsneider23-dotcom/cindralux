import type {
  AiChatResponse,
  AiMessage,
  AppConfigPatch,
  CalendarEventsResponse,
  CalendarValidation,
  GeoResult,
  GoogleCalendarEntry,
  GoogleStatus,
  DailyBriefingRequest,
  HealthResponse,
  AppTimer,
  CreateEventRequest,
  CreateEventResult,
  CreateTimerRequest,
  GptLiveOpenResult,
  HomeAssistantCallRequest,
  HomeAssistantCallResult,
  HomeAssistantEntityList,
  HomeAssistantStatus,
  PhotoItem,
  PhotoLibrary,
  SensorReading,
  TimerListResponse,
  PublicAppConfig,
  RealtimeSessionResponse,
  TrashResponse,
  WeatherSummary,
  InputDevices,
} from '@shared/types';

/** Im Dev-Modus proxyt Vite /api ans Backend, im Build liefert Express beides aus. */
const BASE = '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string; detail?: string; message?: string };
      detail = body.detail ?? body.error ?? body.message ?? detail;
    } catch {
      // Antwort war kein JSON — die Statuszeile reicht.
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
}

export interface TestResult {
  ok: boolean;
  message: string;
}

export const api = {
  health: () => request<HealthResponse>('/health'),

  getConfig: () => request<PublicAppConfig>('/config'),
  inputDevices: () => request<InputDevices>('/system/input'),
  powerAvailable: () => request<{ available: boolean }>('/system/power'),
  power: (action: 'reboot' | 'shutdown') =>
    post<{ ok: boolean; message: string }>(`/system/power/${action}`),
  saveConfig: (patch: AppConfigPatch) =>
    request<PublicAppConfig>('/config', { method: 'PUT', body: JSON.stringify(patch) }),

  calendarEvents: (force = false) =>
    request<CalendarEventsResponse>(`/calendar/events${force ? '?force=1' : ''}`),
  refreshCalendar: () => post<CalendarEventsResponse>('/calendar/refresh'),
  createEvent: (payload: CreateEventRequest) =>
    post<CreateEventResult>('/calendar/events', payload),
  validateCalendar: (url: string) => post<CalendarValidation>('/calendar/validate', { url }),

  googleStatus: () => request<GoogleStatus & { redirectUri: string }>('/google/status'),
  googleAuthUrl: () => request<{ url: string; redirectUri: string }>('/google/auth-url'),
  googleCalendars: async () =>
    (await request<{ calendars: GoogleCalendarEntry[] }>('/google/calendars')).calendars,
  googleDisconnect: () => post<{ ok: boolean }>('/google/disconnect'),

  trash: () => request<TrashResponse>('/trash/next'),
  validateTrashIcs: (url: string) =>
    post<{ ok: boolean; message: string; count?: number }>('/trash/validate', { url }),

  searchPlaces: async (query: string) =>
    (await request<{ results: GeoResult[] }>(`/geo/search?q=${encodeURIComponent(query)}`)).results,
  reverseGeocode: async (lat: number, lon: number) =>
    (await request<{ result: GeoResult | null }>(`/geo/reverse?lat=${lat}&lon=${lon}`)).result,
  weather: (force = false) => request<WeatherSummary>(`/weather${force ? '?force=1' : ''}`),

  homeAssistantStatus: () => request<HomeAssistantStatus>('/home-assistant/status'),
  entities: (force = false) =>
    request<HomeAssistantEntityList>(`/home-assistant/entities${force ? '?force=1' : ''}`),
  sensors: () => request<{ sensors: SensorReading[] }>('/home-assistant/sensors'),

  photoLibrary: () => request<PhotoLibrary>('/photos'),
  activePhotos: async () => (await request<{ photos: PhotoItem[] }>('/photos/active')).photos,
  callService: (payload: HomeAssistantCallRequest) =>
    post<HomeAssistantCallResult>('/home-assistant/call-service', payload),

  chat: (messages: AiMessage[], includeContext = true) =>
    post<AiChatResponse>('/ai/chat', { messages, includeContext }),
  dailyBriefing: (payload: DailyBriefingRequest = {}) =>
    post<AiChatResponse>('/ai/daily-briefing', payload),
  realtimeSession: () => post<RealtimeSessionResponse>('/ai/realtime/session'),
  openGptLive: () => post<GptLiveOpenResult>('/ai/gpt-live/open'),

  timers: () => request<TimerListResponse>('/timers'),
  createTimer: (payload: CreateTimerRequest) => post<AppTimer>('/timers', payload),
  dismissTimer: (id: string) => post<AppTimer>(`/timers/${id}/dismiss`),
  dismissAllTimers: () => post<{ dismissed: number }>('/timers/dismiss-all'),
  deleteTimer: (id: string) =>
    request<{ ok: boolean }>(`/timers/${id}`, { method: 'DELETE' }),

  testHomeAssistant: () => post<TestResult>('/test/home-assistant'),
  testAi: () => post<TestResult>('/test/ai'),
  testRealtime: () => post<TestResult>('/test/realtime'),
  testCalendar: () => post<TestResult>('/test/calendar'),
  testWeather: () => post<TestResult>('/test/weather'),
};
