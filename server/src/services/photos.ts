import fs from 'node:fs/promises';
import path from 'node:path';
import type { PhotoItem, PhotoLibrary } from '../../../shared/types.ts';
import { ROOT_DIR } from '../lib/paths.ts';
import { describeError } from '../lib/http.ts';
import { loadConfig } from './config.ts';

/**
 * Bilder für die Diashow im Ruhemodus.
 *
 * Lokale Dateien sind die verlässliche Grundlage: Sie brauchen kein Konto und
 * funktionieren, wenn das Internet ausfällt — bei einem Panel, das rund um die
 * Uhr läuft, der entscheidende Punkt. Bilder aus Google Photos kommen über die
 * Picker-API dazu; deren Auswahl trifft man in Googles eigenem Fenster, weil
 * Google den Zugriff auf die gesamte Mediathek 2025 abgeschafft hat.
 */

/**
 * Erlaubte Dateiendungen.
 *
 * SVG ist dabei, weil sich damit eigene Grafiken einbinden lassen. Sie werden
 * ausschliesslich als <img> angezeigt — dort fuehrt der Browser kein Skript
 * aus, das in einer SVG-Datei stehen koennte.
 */
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg']);

/** Verzeichnis auflösen — relativ zum Projekt oder absolut. */
export async function resolveLocalDir(): Promise<string> {
  const config = await loadConfig();
  const dir = config.photos.localDir.trim() || 'data/photos';
  return path.isAbsolute(dir) ? dir : path.join(ROOT_DIR, dir);
}

/**
 * Sicherstellen, dass ein angefragter Dateiname im Bilderordner liegt.
 *
 * Ohne diese Prüfung könnte eine Anfrage mit `../` beliebige Dateien des
 * Systems ausliefern.
 */
export async function resolvePhotoPath(name: string): Promise<string | null> {
  const dir = await resolveLocalDir();
  const target = path.resolve(dir, name);
  const withinDir = target === dir || target.startsWith(dir + path.sep);
  if (!withinDir) return null;
  if (!EXTENSIONS.has(path.extname(target).toLowerCase())) return null;

  try {
    const stat = await fs.stat(target);
    return stat.isFile() ? target : null;
  } catch {
    return null;
  }
}

export async function listPhotos(): Promise<PhotoLibrary> {
  const config = await loadConfig();
  const dir = await resolveLocalDir();
  const chosen = new Set(config.photos.selected);

  let entries: string[] = [];
  let message: string | undefined;

  try {
    entries = (await fs.readdir(dir))
      .filter((name) => EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'de'));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    message =
      code === 'ENOENT'
        ? `Ordner ${dir} existiert nicht — anlegen und Bilder hineinlegen.`
        : describeError(error);
  }

  const photos: PhotoItem[] = entries.map((name) => ({
    id: `local:${name}`,
    name,
    url: `/api/photos/file/${encodeURIComponent(name)}`,
    origin: 'local',
    // Ohne Auswahl laufen alle Bilder — sonst bliebe die Diashow leer,
    // solange niemand etwas angehakt hat.
    selected: chosen.size === 0 || chosen.has(`local:${name}`),
  }));

  if (!message && photos.length === 0) {
    message = `Keine Bilder in ${dir}. Bilder dorthin kopieren (jpg, png, webp).`;
  }

  return { photos, localDir: dir, message };
}

/** Nur die Bilder, die die Diashow tatsächlich zeigen soll. */
export async function activePhotos(): Promise<PhotoItem[]> {
  const library = await listPhotos();
  return library.photos.filter((photo) => photo.selected);
}
