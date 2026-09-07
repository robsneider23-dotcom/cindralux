import type {
  AiChatResponse,
  AiMessage,
  CalendarEvent,
  DailyBriefingRequest,
  TrashResponse,
  WeatherSummary,
} from '../../../shared/types.ts';
import { fetchWithTimeout, describeError } from '../lib/http.ts';
import { addDays, startOfDay, toDateKey } from '../lib/dates.ts';
import { loadConfig } from './config.ts';
import { getCalendarEvents } from './calendar.ts';
import { getTrashSchedule } from './trash.ts';
import { getWeather } from './weather.ts';
import { getStatus as getHomeAssistantStatus } from './homeAssistant.ts';

/**
 * OpenAI-kompatibler Client. Funktioniert mit api.openai.com genauso wie mit
 * LM Studio, Ollama (/v1), llama.cpp oder jedem anderen Server, der
 * POST /chat/completions spricht. Ohne API-Key liefert der Dienst
 * ausformulierte Antworten aus den echten lokalen Daten — kein Lorem ipsum.
 */

const TIME_FMT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
const DAY_FMT = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
const SHORT_DAY_FMT = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });

interface Context {
  today: CalendarEvent[];
  upcoming: CalendarEvent[];
  weather: WeatherSummary;
  trash: TrashResponse;
  homeAssistantMode: 'live' | 'mock';
}

async function gatherContext(reference = new Date()): Promise<Context> {
  const [calendar, weather, trash, ha] = await Promise.all([
    getCalendarEvents(),
    getWeather(),
    getTrashSchedule(),
    getHomeAssistantStatus(),
  ]);

  const dayKey = toDateKey(reference);
  const horizon = addDays(startOfDay(reference), 7).getTime();

  const today = calendar.events.filter((event) => toDateKey(new Date(event.start)) === dayKey);
  const upcoming = calendar.events.filter((event) => {
    const start = new Date(event.start);
    return toDateKey(start) !== dayKey && start.getTime() >= startOfDay(reference).getTime()
      && start.getTime() <= horizon;
  });

  return { today, upcoming, weather, trash, homeAssistantMode: ha.mode };
}

function formatEvent(event: CalendarEvent): string {
  if (event.allDay) return `ganztägig — ${event.title} (${event.calendarName})`;
  const start = TIME_FMT.format(new Date(event.start));
  const end = TIME_FMT.format(new Date(event.end));
  const place = event.location ? `, ${event.location}` : '';
  return `${start}–${end} ${event.title} (${event.calendarName}${place})`;
}

/** Kompakter Klartext-Kontext, der als System-Nachricht mitgeschickt wird. */
function renderContext(context: Context, reference: Date): string {
  const lines: string[] = [];
  lines.push(`Heute ist ${DAY_FMT.format(reference)}, ${TIME_FMT.format(reference)} Uhr.`);

  lines.push(
    `Wetter in ${context.weather.locationName}: ${context.weather.temperature} °C, ` +
      `${context.weather.description}, Höchstwert ${context.weather.high} °C, ` +
      `Tiefstwert ${context.weather.low} °C, Regenwahrscheinlichkeit ` +
      `${context.weather.precipitationChance} %, Wind ${context.weather.windSpeed} km/h.`,
  );

  lines.push(
    context.today.length
      ? `Termine heute:\n${context.today.map((e) => `- ${formatEvent(e)}`).join('\n')}`
      : 'Termine heute: keine.',
  );

  if (context.upcoming.length) {
    const next = context.upcoming.slice(0, 8).map((event) => {
      const day = SHORT_DAY_FMT.format(new Date(event.start));
      return `- ${day}: ${formatEvent(event)}`;
    });
    lines.push(`Kommende 7 Tage:\n${next.join('\n')}`);
  }

  const nextTrash = context.trash.next;
  lines.push(
    nextTrash
      ? `Nächste Müllabholung: ${nextTrash.label} am ${DAY_FMT.format(new Date(nextTrash.date))}` +
          ` (in ${nextTrash.daysUntil} Tagen).`
      : 'Müllabholung: keine Regel hinterlegt.',
  );

  lines.push(
    `Smart Home: Home Assistant läuft im Modus "${context.homeAssistantMode}".`,
  );

  return lines.join('\n\n');
}

/* -------------------------------------------------------------------------- */
/* Mock-Antworten aus echten Daten                                             */
/* -------------------------------------------------------------------------- */

function mockBriefing(context: Context, reference: Date): string {
  const parts: string[] = [];
  parts.push(`${DAY_FMT.format(reference)}.`);
  parts.push(
    `${context.weather.temperature} °C, ${context.weather.description.toLowerCase()}. ` +
      `Heute ${context.weather.low}–${context.weather.high} °C` +
      (context.weather.precipitationChance >= 40
        ? `, ${context.weather.precipitationChance} % Regen — Jacke einpacken.`
        : '.'),
  );

  if (context.today.length === 0) {
    parts.push('Keine Termine im Kalender. Der Tag gehört dir.');
  } else {
    const timed = context.today.filter((e) => !e.allDay);
    const first = timed[0];
    parts.push(
      `${context.today.length} Termin${context.today.length === 1 ? '' : 'e'}` +
        (first ? `, der erste um ${TIME_FMT.format(new Date(first.start))} Uhr: ${first.title}.` : '.'),
    );
    if (timed.length > 1) {
      parts.push(
        `Danach: ${timed
          .slice(1, 4)
          .map((e) => `${TIME_FMT.format(new Date(e.start))} ${e.title}`)
          .join(', ')}.`,
      );
    }
  }

  const trash = context.trash.next;
  if (trash?.isToday) parts.push(`Achtung: ${trash.label} wird heute abgeholt.`);
  else if (trash?.isTomorrow) parts.push(`${trash.label} morgen rausstellen.`);
  else if (trash) parts.push(`${trash.label} in ${trash.daysUntil} Tagen.`);

  return parts.join(' ');
}

function mockAgenda(context: Context): string {
  if (context.today.length === 0) {
    const next = context.upcoming[0];
    return next
      ? `Heute steht nichts an. Der nächste Termin ist ${SHORT_DAY_FMT.format(new Date(next.start))}: ${next.title}.`
      : 'Heute und in den nächsten sieben Tagen steht nichts im Kalender.';
  }
  const lines = context.today.map((event) => `• ${formatEvent(event)}`);
  return `Heute stehen ${context.today.length} Termine an:\n${lines.join('\n')}`;
}

function mockSmartHome(context: Context, reference: Date): string {
  const hour = reference.getHours();
  const rain = context.weather.precipitationChance >= 50;

  if (hour >= 21 || hour < 5) {
    return 'Vorschlag: Nachtmodus aktivieren — Licht aus, Heizung auf 18 °C absenken, Türen prüfen.';
  }
  if (hour >= 17) {
    return rain
      ? 'Vorschlag: Film-Modus. Draußen regnet es, Wohnzimmerlicht auf 30 % dimmen und Heizung auf 21 °C.'
      : 'Vorschlag: Wohnzimmerlicht auf warmes Abendlicht, Heizung auf 21 °C Komfort.';
  }
  if (hour < 9) {
    return `Vorschlag: Küchenlicht an, Heizung auf 21 °C. Draußen ${context.weather.temperature} °C bei ${context.weather.description.toLowerCase()}.`;
  }
  return 'Vorschlag: Tagsüber alles aus — spart Strom. Heizung auf 19 °C Eco, bis jemand zu Hause ist.';
}

function mockAnswer(question: string, context: Context, reference: Date): string {
  const q = question.toLowerCase();
  if (/briefing|überblick|uberblick|zusammenfass/.test(q)) return mockBriefing(context, reference);
  if (/termin|kalender|heute an|agenda|vor/.test(q)) return mockAgenda(context);
  if (/licht|smart|heizung|szene|schalt/.test(q)) return mockSmartHome(context, reference);
  if (/wetter|regen|temperatur|warm|kalt/.test(q)) {
    const tomorrow = context.weather.forecast[1];
    return (
      `${context.weather.locationName}: aktuell ${context.weather.temperature} °C, ` +
      `${context.weather.description.toLowerCase()}, gefühlt ${context.weather.apparentTemperature} °C. ` +
      `Heute ${context.weather.low} bis ${context.weather.high} °C.` +
      (tomorrow ? ` Morgen ${tomorrow.min}–${tomorrow.max} °C, ${tomorrow.description.toLowerCase()}.` : '')
    );
  }
  if (/müll|muell|tonne|abholung/.test(q)) {
    const next = context.trash.next;
    return next
      ? `${next.label} wird ${next.isToday ? 'heute' : next.isTomorrow ? 'morgen' : `am ${DAY_FMT.format(new Date(next.date))}`} abgeholt.`
      : 'Es ist keine Müllabfuhr-Regel hinterlegt.';
  }

  return (
    'Es ist kein AI-Zugang hinterlegt — deshalb antworte ich aus den lokalen Daten.\n\n' +
    mockBriefing(context, reference) +
    '\n\nFür echte Antworten in den Einstellungen unter AI eine Base-URL, ein Modell und einen API-Key eintragen (OpenAI, LM Studio oder ein anderer OpenAI-kompatibler Server).'
  );
}

/* -------------------------------------------------------------------------- */
/* Live-Aufruf                                                                 */
/* -------------------------------------------------------------------------- */

interface ChatCompletionResponse {
  choices?: Array<{ message?: { role?: string; content?: string } }>;
  error?: { message?: string };
}

async function callChatCompletions(messages: AiMessage[]): Promise<AiChatResponse> {
  const config = await loadConfig();
  const base = config.ai.baseUrl.replace(/\/+$/, '');

  const response = await fetchWithTimeout(
    `${base}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages,
        temperature: 0.4,
        max_tokens: 500,
      }),
    },
    30_000,
    { allowPrivate: true },
  );

  const data = (await response.json()) as ChatCompletionResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? `HTTP ${response.status}`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Leere Antwort vom Modell');

  return {
    message: { role: 'assistant', content },
    mode: 'live',
    model: config.ai.model,
  };
}

/**
 * Persona samt aktuellem Haushalts-Kontext fuer den Sprachmodus.
 *
 * Der Sprachassistent bekommt denselben Kontext wie der Textchat, aber eine
 * andere Stilanweisung: gesprochene Antworten muessen kuerzer sein und duerfen
 * keine Aufzaehlungen oder Formatierung enthalten.
 */
export async function buildVoiceInstructions(): Promise<string> {
  const config = await loadConfig();
  const reference = new Date();
  const context = await gatherContext(reference);

  const sections = [
    config.ai.systemPrompt,
    'Du wirst per Sprache bedient und antwortest per Sprache. Sprich Deutsch. ' +
      'Halte dich kurz — zwei bis drei Sätze, es sei denn, es wird ausdrücklich ' +
      'mehr verlangt. Keine Aufzählungszeichen, keine Überschriften, keine ' +
      'Emojis: alles wird vorgelesen. Uhrzeiten sprichst du natürlich aus ' +
      '("halb vier" statt "15:30"). Wenn du etwas nicht aus dem Kontext weißt, ' +
      'sag das in einem Satz.',
  ];

  // Geräte und Szenen gibt es nur über das dazugehörige Werkzeug zu schalten —
  // mit den exakten Namen, die in dessen Beschreibung stehen.
  if ((config.smartHomeActions ?? []).length > 0) {
    sections.push(
      'Smart Home: Geräte an- und ausschalten oder Szenen auslösen geht ausschließlich über ' +
        'die Smart-Home-Werkzeuge, mit dem exakten Namen eines konfigurierten Geräts. Behaupte nie ' +
        'etwas Geschaltetes, ohne das Werkzeug aufgerufen zu haben — nach erfolgreicher Ausführung ' +
        'bestätige kurz in einem Satz.',
    );
  }

  sections.push(`Aktueller Zustand des Haushalts:\n\n${renderContext(context, reference)}`);
  return sections.join('\n\n');
}

export async function isAiConfigured(): Promise<boolean> {
  const config = await loadConfig();
  return Boolean(config.ai.apiKey.trim() && config.ai.baseUrl.trim() && config.ai.model.trim());
}

/** Freie Frage an den Assistenten, optional mit Haus-Kontext. */
export async function chat(
  messages: AiMessage[],
  includeContext = true,
): Promise<AiChatResponse> {
  const config = await loadConfig();
  const reference = new Date();
  const context = await gatherContext(reference);
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');

  if (!(await isAiConfigured())) {
    return {
      message: { role: 'assistant', content: mockAnswer(lastUser?.content ?? '', context, reference) },
      mode: 'mock',
    };
  }

  const payload: AiMessage[] = [{ role: 'system', content: config.ai.systemPrompt }];
  if (includeContext) {
    payload.push({
      role: 'system',
      content: `Aktueller Zustand des Haushalts:\n\n${renderContext(context, reference)}`,
    });
  }
  payload.push(...messages.filter((m) => m.role !== 'system'));

  try {
    return await callChatCompletions(payload);
  } catch (error) {
    console.warn(`[ai] Aufruf fehlgeschlagen: ${describeError(error)}`);
    return {
      message: { role: 'assistant', content: mockAnswer(lastUser?.content ?? '', context, reference) },
      mode: 'mock',
      message_error: describeError(error),
    };
  }
}

/** Tagesbriefing aus Kalender, Wetter und Muellabholung. */
export async function dailyBriefing(request: DailyBriefingRequest = {}): Promise<AiChatResponse> {
  const reference = request.date ? new Date(request.date) : new Date();
  const context = await gatherContext(reference);

  if (!(await isAiConfigured())) {
    return { message: { role: 'assistant', content: mockBriefing(context, reference) }, mode: 'mock' };
  }

  const config = await loadConfig();
  const length =
    request.tone === 'ausfuehrlich'
      ? 'Nimm dir bis zu acht Sätze Zeit.'
      : 'Maximal fünf kurze Sätze.';

  try {
    return await callChatCompletions([
      { role: 'system', content: config.ai.systemPrompt },
      {
        role: 'user',
        content:
          `Erstelle mein Tagesbriefing. ${length} ` +
          'Reihenfolge: Wetter, wichtigste Termine, Müllabholung, ein konkreter Hinweis. ' +
          'Keine Aufzählungszeichen, keine Begrüßungsfloskel.\n\n' +
          renderContext(context, reference),
      },
    ]);
  } catch (error) {
    console.warn(`[ai] Briefing fehlgeschlagen: ${describeError(error)}`);
    return {
      message: { role: 'assistant', content: mockBriefing(context, reference) },
      mode: 'mock',
      message_error: describeError(error),
    };
  }
}

/** Verbindungstest fuer die Einstellungen. */
export async function testAiConnection(): Promise<{ ok: boolean; message: string }> {
  if (!(await isAiConfigured())) {
    return { ok: false, message: 'Base-URL, Modell oder API-Key fehlt' };
  }
  try {
    const result = await callChatCompletions([
      { role: 'user', content: 'Antworte exakt mit: OK' },
    ]);
    return { ok: true, message: `Antwort erhalten (${result.model})` };
  } catch (error) {
    return { ok: false, message: describeError(error) };
  }
}

