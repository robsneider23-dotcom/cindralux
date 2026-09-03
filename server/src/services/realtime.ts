import type { RealtimeSessionResponse, RealtimeTool } from '../../../shared/types.ts';
import { fetchWithTimeout, describeError } from '../lib/http.ts';
import { loadConfig } from './config.ts';
import { buildVoiceInstructions } from './ai.ts';

/**
 * Sprachmodus über die OpenAI Realtime API.
 *
 * Ablauf: Der Browser bekommt von hier ein kurzlebiges Client-Token und baut
 * damit selbst eine WebRTC-Verbindung zu OpenAI auf. Der eigentliche API-Key
 * verlässt den Pi nie. Ein Server-Relay wäre die Alternative, würde den
 * Audiostrom aber ohne Sicherheitsgewinn durch den Pi schleifen und Latenz
 * kosten — bei einem Sprachdialog der entscheidende Nachteil.
 *
 * HINWEIS: Die Realtime-API ist nur bei OpenAI selbst verfügbar. Lokale
 * OpenAI-kompatible Server (LM Studio, Ollama) sprechen sie nicht — der
 * Textchat funktioniert dort weiterhin.
 */

/** Werkzeuge des Sprachassistenten — Timer und Wecker sind fest verdrahtet. */
const TIMER_TOOLS: RealtimeTool[] = [
  {
    type: 'function',
    name: 'timer_stellen',
    description:
      'Stellt einen Kurzzeit-Timer, der nach der angegebenen Dauer klingelt. ' +
      'Für feste Uhrzeiten stattdessen wecker_stellen benutzen.',
    parameters: {
      type: 'object',
      properties: {
        sekunden: {
          type: 'integer',
          description: 'Laufzeit in Sekunden, z. B. 600 für zehn Minuten.',
          minimum: 1,
          maximum: 86400,
        },
        bezeichnung: {
          type: 'string',
          description: 'Wofür der Timer ist, z. B. "Nudeln" oder "Ofen".',
        },
      },
      required: ['sekunden'],
    },
  },
  {
    type: 'function',
    name: 'wecker_stellen',
    description: 'Stellt einen Wecker auf eine feste Uhrzeit, optional wiederkehrend.',
    parameters: {
      type: 'object',
      properties: {
        uhrzeit: {
          type: 'string',
          description: 'Uhrzeit im Format HH:MM, 24-Stunden, z. B. "06:45".',
        },
        bezeichnung: { type: 'string', description: 'Wofür der Wecker ist.' },
        wochentage: {
          type: 'array',
          description:
            'Wochentage zum Wiederholen: 0 = Sonntag bis 6 = Samstag. Leer lassen für einmalig.',
          items: { type: 'integer', minimum: 0, maximum: 6 },
        },
      },
      required: ['uhrzeit'],
    },
  },
  {
    type: 'function',
    name: 'timer_auflisten',
    description: 'Listet alle laufenden Timer und gestellten Wecker auf.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'timer_loeschen',
    description: 'Löscht einen Timer oder Wecker anhand seiner Bezeichnung.',
    parameters: {
      type: 'object',
      properties: {
        bezeichnung: { type: 'string', description: 'Bezeichnung des zu löschenden Eintrags.' },
      },
      required: ['bezeichnung'],
    },
  },
];

/**
 * Smart-Home-Werkzeug aus der Konfiguration bauen.
 *
 * Die verfügbaren Geräte und Szenen stehen mit ihren exakten Namen in der
 * Beschreibung — das Modell soll nur auswählen, was es gibt. Ohne
 * konfigurierte Aktionen bleibt der Sprachmodus bei Timer und Wecker.
 */
async function buildSmartHomeTools(): Promise<RealtimeTool[]> {
  try {
    const config = await loadConfig();
    const actions = (config.smartHomeActions ?? []).filter(
      (action) => Boolean(action.entityId && action.service),
    );
    if (actions.length === 0) return [];

    const names = actions.map((action) => action.label).join(', ');
    return [
      {
        type: 'function',
        name: 'smart_home_steuern',
        description:
          'Schaltet ein Smart-Home-Gerät an oder aus bzw. löst eine Szene aus. ' +
          `Verfügbare Namen: ${names}. ` +
          "Szenen werden einfach ausgelöst — der Zustand ist für sie egal.",
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: `Genauer Name eines der verfügbaren Geräte oder Szenen, z. B. "${actions[0]?.label ?? ''}".`,
            },
            zustand: {
              type: 'string',
              enum: ['an', 'aus'],
              description: "An- oder Ausschalten; bei Szenen egal.",
            },
          },
          required: ['name', 'zustand'],
        },
      },
    ];
  } catch (error) {
    console.warn('[realtime] Smart-Home-Werkzeug übersprungen:', describeError(error));
    return [];
  }
}

export class RealtimeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'RealtimeError';
  }
}

interface MintResult {
  clientSecret: string;
  expiresAt: number;
  variant: 'ga' | 'beta';
}

/** Antwortform der GA-Variante (POST /v1/realtime/client_secrets). */
interface ClientSecretResponse {
  value?: string;
  expires_at?: number;
  client_secret?: { value?: string; expires_at?: number };
  error?: { message?: string };
}

function readSecret(body: ClientSecretResponse, variant: 'ga' | 'beta'): MintResult | null {
  // GA liefert { value, expires_at }, die Beta { client_secret: { value, … } }.
  const value = body.value ?? body.client_secret?.value;
  const expiresAt = body.expires_at ?? body.client_secret?.expires_at;
  if (!value) return null;
  return {
    clientSecret: value,
    // Ohne Angabe eine Minute annehmen — das Token ist ohnehin kurzlebig.
    expiresAt: expiresAt ?? Math.floor(Date.now() / 1000) + 60,
    variant,
  };
}

/**
 * Kurzlebiges Client-Token besorgen.
 *
 * OpenAI hat die Realtime-API von Beta auf GA umgestellt und dabei
 * Endpunkt und Request-Form geändert. Wir versuchen zuerst die GA-Form und
 * fallen auf die Beta-Form zurück, damit das Panel nicht davon abhängt,
 * welche Variante der jeweilige Account bedient.
 */
async function mintClientSecret(model: string, voice: string): Promise<MintResult> {
  const config = await loadConfig();
  const apiKey = config.ai.apiKey;
  const { sessionUrl } = config.ai.realtime;

  const attempts: Array<{
    variant: 'ga' | 'beta';
    url: string;
    headers: Record<string, string>;
    body: unknown;
  }> = [
    {
      variant: 'ga',
      url: sessionUrl,
      headers: {},
      body: {
        session: {
          type: 'realtime',
          model,
          audio: { output: { voice } },
        },
      },
    },
    {
      variant: 'beta',
      // Die Beta lag unter /v1/realtime/sessions.
      url: sessionUrl.replace(/\/client_secrets$/, '/sessions'),
      headers: { 'OpenAI-Beta': 'realtime=v1' },
      body: { model, voice },
    },
  ];

  let lastMessage = 'Unbekannter Fehler';
  let lastStatus = 502;

  for (const attempt of attempts) {
    try {
      const response = await fetchWithTimeout(
        attempt.url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            ...attempt.headers,
          },
          body: JSON.stringify(attempt.body),
        },
        15_000,
      );

      const body = (await response.json().catch(() => ({}))) as ClientSecretResponse;

      if (response.ok) {
        const secret = readSecret(body, attempt.variant);
        if (secret) return secret;
        lastMessage = 'Antwort enthielt kein Client-Token';
        lastStatus = 502;
        continue;
      }

      lastStatus = response.status;
      lastMessage = body.error?.message ?? `HTTP ${response.status}`;

      // 401/403 sind eindeutig: der Key stimmt nicht oder hat keinen Zugriff.
      // Ein zweiter Versuch mit anderer Request-Form ändert daran nichts.
      if (response.status === 401 || response.status === 403) break;
    } catch (error) {
      lastMessage = describeError(error);
      lastStatus = 502;
    }
  }

  throw new RealtimeError(lastMessage, lastStatus);
}

export async function createRealtimeSession(): Promise<RealtimeSessionResponse> {
  const config = await loadConfig();
  const { realtime, apiKey, baseUrl } = config.ai;

  if (!realtime.enabled) {
    throw new RealtimeError('Sprachmodus ist in den Einstellungen deaktiviert', 409);
  }

  if (!apiKey.trim()) {
    throw new RealtimeError(
      'Kein API-Key hinterlegt. Der Sprachmodus braucht einen OpenAI-API-Key ' +
        '(platform.openai.com) — ein ChatGPT-Abo genügt dafür nicht.',
      409,
    );
  }

  if (!/api\.openai\.com/.test(baseUrl) && !/api\.openai\.com/.test(realtime.sessionUrl)) {
    console.warn(
      '[realtime] Basis-URL zeigt nicht auf OpenAI — die Realtime-API bieten ' +
        'lokale Server (LM Studio, Ollama) nicht an.',
    );
  }

  // Token und Initial-State parallel holen — das Smart-Home-Werkzeug wird
  // frisch aus der Konfiguration gebaut und kennt nur konfigurierte Geräte.
  const [secretResult, instructions, smartHomeTools] = await Promise.all([
    mintClientSecret(realtime.model, realtime.voice),
    buildVoiceInstructions(),
    buildSmartHomeTools(),
  ]);

  return {
    clientSecret: secretResult.clientSecret,
    expiresAt: secretResult.expiresAt,
    variant: secretResult.variant,
    model: realtime.model,
    voice: realtime.voice,
    callUrl: realtime.callUrl,
    transcriptionModel: realtime.transcriptionModel,
    instructions,
    tools: [...TIMER_TOOLS, ...smartHomeTools],
  };
}

/** Verbindungstest für die Einstellungen — stellt ein Token aus und verwirft es. */
export async function testRealtime(): Promise<{ ok: boolean; message: string }> {
  try {
    const session = await createRealtimeSession();
    const seconds = Math.max(0, session.expiresAt - Math.floor(Date.now() / 1000));
    return {
      ok: true,
      message: `Token erhalten (Modell ${session.model}, Stimme ${session.voice}, gültig ${seconds}s)`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof RealtimeError ? error.message : describeError(error),
    };
  }
}
