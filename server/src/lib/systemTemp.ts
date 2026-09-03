import { readFile } from 'node:fs/promises';

const THERMAL_ZONE_FILE = '/sys/class/thermal/thermal_zone0/temp';

/**
 * CPU-Temperatur des Pi in Grad Celsius, gerundet auf eine Nachkommastelle.
 *
 * `/sys/class/thermal/thermal_zone0/temp` liefert Millidegree als reinen
 * Text (z. B. "48382"). Existiert die Datei nicht — jeder Rechner ohne
 * diesen Sensor, etwa beim lokalen `npm run dev` auf dem Desktop — gibt es
 * `null` statt eines Fehlers; der Wert ist rein informativ.
 */
export async function readCpuTemperatureC(): Promise<number | null> {
  try {
    const raw = await readFile(THERMAL_ZONE_FILE, 'utf8');
    const milliDegrees = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(milliDegrees)) return null;
    return Math.round(milliDegrees / 100) / 10;
  } catch {
    return null;
  }
}
