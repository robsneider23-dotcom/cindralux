import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/*
 * Neustart und Herunterfahren des Geraets.
 *
 * Der Dienst laeuft als normaler Benutzer und darf das nicht von sich aus.
 * Beides braucht deshalb eine einmalige sudo-Regel (deploy/rubicon-power.sudoers).
 * Ohne sie schlaegt der Aufruf fehl — mit einer Meldung, die sagt, was zu tun
 * ist, statt nur „permission denied".
 */

export type PowerAction = 'reboot' | 'shutdown';

const BEFEHL: Record<PowerAction, string> = {
  reboot: '/sbin/reboot',
  shutdown: '/sbin/poweroff',
};

const HINWEIS =
  'Der Dienst darf das Geraet nicht neu starten. Einmalig einrichten: ' +
  'sudo cp ~/rubicon/deploy/rubicon-power.sudoers /etc/sudoers.d/rubicon-power ' +
  '&& sudo chmod 440 /etc/sudoers.d/rubicon-power';

export interface PowerResult {
  ok: boolean;
  message: string;
}

/** Prueft, ob die sudo-Regel greift — ohne irgendetwas auszufuehren. */
export async function powerAvailable(): Promise<boolean> {
  try {
    // -n: nie nach einem Passwort fragen. -l: nur nachschlagen, nicht starten.
    await run('sudo', ['-n', '-l', BEFEHL.reboot]);
    return true;
  } catch {
    return false;
  }
}

export async function powerAction(action: PowerAction): Promise<PowerResult> {
  if (!(await powerAvailable())) {
    return { ok: false, message: HINWEIS };
  }

  /*
   * Erst antworten, dann ausschalten. Andernfalls bricht die Verbindung ab,
   * bevor die Bestaetigung ankommt, und man weiss nicht, ob der Befehl
   * angekommen ist oder das Dashboard nur haengt.
   */
  setTimeout(() => {
    void run('sudo', ['-n', BEFEHL[action]]).catch(() => undefined);
  }, 1200);

  return {
    ok: true,
    message:
      action === 'reboot'
        ? 'Der Pi startet neu. Das Dashboard ist in etwa einer Minute wieder da.'
        : 'Der Pi faehrt herunter. Warte, bis die gruene LED aufhoert zu blinken, bevor du den Strom trennst.',
  };
}
