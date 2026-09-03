import { readdir, readFile } from 'node:fs/promises';
import type { InputDevices } from '../../../shared/types.ts';

/*
 * Erkennt angeschlossene Eingabegeraete.
 *
 * Der Browser kann das nicht: Er sieht nur, ob Tastendruecke ankommen, und
 * `navigator.maxTouchPoints` sagt nichts ueber eine Tastatur. Das System weiss
 * es dagegen genau — udev legt fuer jede echte Tastatur einen Symlink
 * `/dev/input/by-path/…-event-kbd` an.
 */

const BY_PATH = '/dev/input/by-path';
const BY_ID = '/dev/input/by-id';
const PROC_DEVICES = '/proc/bus/input/devices';

/** Geraete, die zwar Tasten melden, aber keine Tastatur sind. */
const KEINE_TASTATUR = /power|sleep|lid|video bus|hdmi|jack|consumer control|system control/i;

async function symlinkNamen(verzeichnis: string): Promise<string[]> {
  try {
    return await readdir(verzeichnis);
  } catch {
    // Verzeichnis fehlt, wenn kein udev laeuft oder gar kein Geraet da ist.
    return [];
  }
}

/**
 * Namen aller Eingabegeraete aus /proc — nur fuer die Anzeige in den
 * Einstellungen, nicht fuer die Entscheidung.
 */
async function geraeteNamen(): Promise<string[]> {
  try {
    const text = await readFile(PROC_DEVICES, 'utf8');
    const namen = [...text.matchAll(/^N: Name="([^"]*)"/gm)]
      .map((treffer) => treffer[1] ?? '')
      .filter((name) => name.length > 0);
    return namen.filter((name, index) => namen.indexOf(name) === index);
  } catch {
    return [];
  }
}

export async function readInputDevices(): Promise<InputDevices> {
  const [byPath, byId, namen] = await Promise.all([
    symlinkNamen(BY_PATH),
    symlinkNamen(BY_ID),
    geraeteNamen(),
  ]);

  const tastaturLinks = [...byPath, ...byId].filter(
    (eintrag) => eintrag.endsWith('-event-kbd') && !KEINE_TASTATUR.test(eintrag),
  );

  const touchLinks = [...byPath, ...byId].some((eintrag) =>
    /event-(mouse|touchscreen)|touchscreen/i.test(eintrag),
  );

  return {
    physicalKeyboard: tastaturLinks.length > 0,
    touchScreen: touchLinks || namen.some((name) => /touch/i.test(name)),
    devices: namen,
  };
}
