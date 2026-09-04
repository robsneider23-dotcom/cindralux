import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { DATA_DIR } from '../lib/paths.ts';
import { describeError } from '../lib/http.ts';

const run = promisify(execFile);

/*
 * Neustart, Herunterfahren und Kiosk-Beenden des Geraets.
 *
 * Neustart/Herunterfahren brauchen Root und damit eine einmalige sudo-Regel
 * (deploy/rubicon-power.sudoers) — der Dienst laeuft als normaler Benutzer.
 * "Kiosk beenden" braucht das NICHT: Chromium laeuft als derselbe Benutzer
 * wie der Server, ihn zu beenden ist kein Rechteproblem. Die eigentliche
 * Huerde ist die Neustart-Schleife in deploy/rubicon-kiosk.sh, die Chromium
 * nach jedem Absturz von selbst zurueckholt — genau das soll hier einmalig
 * NICHT passieren. Die Sentinel-Datei ist das Signal dafuer: das Skript
 * prueft sie vor jedem Neustartversuch und beendet sich selbst, statt
 * Chromium erneut zu starten.
 */

export type PowerAction = 'reboot' | 'shutdown' | 'exit-kiosk';

const SUDO_BEFEHL: Record<'reboot' | 'shutdown', string> = {
  reboot: '/sbin/reboot',
  shutdown: '/sbin/poweroff',
};

const EXIT_SENTINEL = path.join(DATA_DIR, '.exit-kiosk');

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
    await run('sudo', ['-n', '-l', SUDO_BEFEHL.reboot]);
    return true;
  } catch {
    return false;
  }
}

export async function powerAction(action: PowerAction): Promise<PowerResult> {
  if (action === 'exit-kiosk') return exitKiosk();

  if (!(await powerAvailable())) {
    return { ok: false, message: HINWEIS };
  }

  /*
   * Erst antworten, dann ausschalten. Andernfalls bricht die Verbindung ab,
   * bevor die Bestaetigung ankommt, und man weiss nicht, ob der Befehl
   * angekommen ist oder das Dashboard nur haengt.
   */
  setTimeout(() => {
    void run('sudo', ['-n', SUDO_BEFEHL[action]]).catch(() => undefined);
  }, 1200);

  return {
    ok: true,
    message:
      action === 'reboot'
        ? 'Der Pi startet neu. Das Dashboard ist in etwa einer Minute wieder da.'
        : 'Der Pi faehrt herunter. Warte, bis die gruene LED aufhoert zu blinken, bevor du den Strom trennst.',
  };
}

async function exitKiosk(): Promise<PowerResult> {
  try {
    // Leere Datei genuegt — deploy/rubicon-kiosk.sh prueft nur, ob sie existiert.
    await writeFile(EXIT_SENTINEL, '');
  } catch (error) {
    return { ok: false, message: `Sentinel-Datei nicht schreibbar: ${describeError(error)}` };
  }

  // Erst antworten, dann Chromium beenden — sonst reisst die Anfrage selbst ab.
  setTimeout(() => {
    void run('pkill', ['-f', '--', '--kiosk']).catch(() => undefined);
  }, 800);

  return {
    ok: true,
    message:
      'Kiosk wird beendet, der Bildschirm zeigt danach den bloßen Desktop. ' +
      'Zurueck zum Dashboard: deploy/rubicon-kiosk.sh erneut starten oder den Pi neu starten.',
  };
}
