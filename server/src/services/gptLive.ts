import { spawn } from 'node:child_process';
import type { GptLiveOpenResult } from '../../../shared/types.ts';
import { describeError } from '../lib/http.ts';
import { loadConfig } from './config.ts';

/**
 * Öffnet ChatGPT in einem eigenen Browserfenster.
 *
 * ChatGPT wird bewusst nicht eingebettet — chatgpt.com verbietet das per
 * `frame-ancestors`, und inoffizielle Umwege wären weder stabil noch erlaubt.
 *
 * SICHERHEIT: Der Befehl kommt ausschließlich aus `data/config.json`, nie aus
 * der Anfrage. Der Client löst nur aus. Gestartet wird ohne Shell, damit auch
 * eine seltsame URL in der Konfiguration keine Befehlskette auslösen kann.
 */

/** Befehlszeile in Argumente zerlegen; doppelte Anführungszeichen halten zusammen. */
function tokenize(command: string): string[] {
  const parts = command.match(/"[^"]*"|\S+/g) ?? [];
  return parts.map((part) => part.replace(/^"|"$/g, ''));
}

export async function openGptLive(): Promise<GptLiveOpenResult> {
  const config = await loadConfig();
  const { gptLive } = config.ai;

  if (!gptLive.enabled) {
    return {
      ok: false,
      handledBy: 'server',
      url: gptLive.url,
      message: 'GPT Live ist in den Einstellungen deaktiviert',
    };
  }

  // Im Tab-Modus macht der Browser die Arbeit; hier gibt es nichts zu starten.
  if (gptLive.mode === 'browser-tab') {
    return {
      ok: true,
      handledBy: 'client',
      url: gptLive.url,
      message: 'Wird im Browser geöffnet',
    };
  }

  const [executable, ...args] = tokenize(gptLive.command);
  if (!executable) {
    return {
      ok: false,
      handledBy: 'server',
      url: gptLive.url,
      message: 'Kein Befehl hinterlegt',
    };
  }

  try {
    // Losgelöst starten: das Fenster soll den Dashboard-Prozess überleben.
    const child = spawn(executable, args, {
      detached: true,
      stdio: 'ignore',
      shell: false,
    });

    // Ein fehlender Befehl meldet sich erst asynchron über 'error'.
    const failure = await new Promise<string | null>((resolve) => {
      const done = setTimeout(() => resolve(null), 400);
      child.once('error', (error) => {
        clearTimeout(done);
        resolve(describeError(error));
      });
    });

    if (failure) {
      return {
        ok: false,
        handledBy: 'server',
        url: gptLive.url,
        message: failure.includes('ENOENT')
          ? `Befehl nicht gefunden: ${executable}`
          : failure,
      };
    }

    child.unref();
    return {
      ok: true,
      handledBy: 'server',
      url: gptLive.url,
      message: `${executable} gestartet`,
    };
  } catch (error) {
    return {
      ok: false,
      handledBy: 'server',
      url: gptLive.url,
      message: describeError(error),
    };
  }
}
