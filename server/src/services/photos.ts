import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  GooglePickerSession,
  GooglePickerStatus,
  PhotoItem,
  PhotoLibrary,
} from '../../../shared/types.ts';
import { ROOT_DIR } from '../lib/paths.ts';
import { describeError } from '../lib/http.ts';
import { readJson, writeJson } from '../lib/jsonStore.ts';
import { loadConfig } from './config.ts';
import {
  createPickerSession,
  deletePickerSession,
  downloadPickerMediaFile,
  getPickerSessionStatus,
  listPickerMediaItems,
  type PickerMediaItem,
} from './google.ts';

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
  // Nur unmittelbare Dateien. realpath schließt Symlinks aus dem Ordner aus.
  if (!name || name !== path.basename(name) || /[\\/\x00]/.test(name) || !EXTENSIONS.has(path.extname(name).toLowerCase())) return null;
  try {
    const dir = await fs.realpath(await resolveLocalDir());
    const target = path.join(dir, name);
    const stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    const real = await fs.realpath(target);
    return path.dirname(real) === dir ? real : null;
  } catch {
    return null;
  }
}

/** Metadaten je Dateiname, immer im Bilderordner selbst — kein Sonderpfad noetig. */
const META_FILE = '.photos-meta.json';
/** Vorgaenger-Datei (nur Herkunftsliste) — wird beim ersten Lesen automatisch uebernommen. */
const LEGACY_GOOGLE_MANIFEST = '.google-origin.json';

interface PhotoMeta {
  /** Fehlt bei lokalen Bildern; nur Google-Importe tragen es. */
  origin?: 'google';
  /** ISO-Zeitstempel, bei Google das Aufnahmedatum laut API. */
  takenAt?: string;
  /** Manuell vergebene Personenmarkierung. */
  person?: string;
  /** Bildausschnitt als object-position-Prozente (0–100), siehe shared/types.ts. */
  focus?: { x: number; y: number };
}

async function readMeta(dir: string): Promise<Record<string, PhotoMeta>> {
  const meta = await readJson<Record<string, PhotoMeta>>(path.join(dir, META_FILE));
  if (meta) return meta;

  // Migration von der alten, reinen Herkunftsliste — einmalig, verlustfrei fuer origin.
  const legacy = await readJson<string[]>(path.join(dir, LEGACY_GOOGLE_MANIFEST));
  if (!legacy) return {};
  const migrated: Record<string, PhotoMeta> = {};
  for (const name of legacy) migrated[name] = { origin: 'google' };
  await writeJson(path.join(dir, META_FILE), migrated);
  return migrated;
}

async function writeMeta(dir: string, meta: Record<string, PhotoMeta>): Promise<void> {
  await writeJson(path.join(dir, META_FILE), meta);
}

export async function listPhotos(): Promise<PhotoLibrary> {
  const config = await loadConfig();
  const dir = await resolveLocalDir();
  const chosen = new Set(config.photos.selected);
  const meta = await readMeta(dir);

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

  const photos: PhotoItem[] = await Promise.all(
    entries.map(async (name): Promise<PhotoItem> => {
      const entryMeta = meta[name];
      const origin = entryMeta?.origin === 'google' ? 'google' : 'local';
      const id = `${origin}:${name}`;

      // Ohne eigenes Aufnahmedatum (lokale Bilder) das Dateidatum nehmen —
      // besser als gar keine Reihenfolge fuer den "Datum"-Modus der Diashow.
      let takenAt = entryMeta?.takenAt;
      if (!takenAt) {
        try {
          takenAt = (await fs.stat(path.join(dir, name))).mtime.toISOString();
        } catch {
          // Kein Datum ist kein Fehler — sortiert dann einfach ans Ende.
        }
      }

      return {
        id,
        name,
        url: `/api/photos/file/${encodeURIComponent(name)}`,
        origin,
        // Ohne Auswahl laufen alle Bilder — sonst bliebe die Diashow leer,
        // solange niemand etwas angehakt hat.
        selected: chosen.size === 0 || chosen.has(id),
        takenAt,
        person: entryMeta?.person,
        focus: entryMeta?.focus,
      };
    }),
  );

  if (!message && photos.length === 0) {
    message = `Keine Bilder in ${dir}. Bilder dorthin kopieren (jpg, png, webp).`;
  }

  return { photos, localDir: dir, message };
}

/**
 * Personenmarkierung eines Bilds setzen oder loeschen (leerer String loescht).
 * Rein manuell — es gibt keine Gesichtserkennung in diesem Projekt.
 */
export async function setPhotoPerson(name: string, person: string): Promise<void> {
  const file = await resolvePhotoPath(name);
  if (!file) throw new Error('Bild nicht gefunden');

  const dir = await resolveLocalDir();
  const meta = await readMeta(dir);
  const trimmed = person.trim();
  const entry = { ...meta[name] };

  if (trimmed) entry.person = trimmed;
  else delete entry.person;

  if (Object.keys(entry).length === 0) delete meta[name];
  else meta[name] = entry;

  await writeMeta(dir, meta);
}

/**
 * Bildausschnitt setzen oder loeschen (ohne Argument: zurueck auf Bildmitte).
 * `x`/`y` sind object-position-Prozente (0–100), vom Rahmen-Editor berechnet.
 */
export async function setPhotoFocus(name: string, focus?: { x: number; y: number }): Promise<void> {
  const file = await resolvePhotoPath(name);
  if (!file) throw new Error('Bild nicht gefunden');

  const dir = await resolveLocalDir();
  const meta = await readMeta(dir);
  const entry = { ...meta[name] };

  if (focus) {
    entry.focus = {
      x: Math.round(Math.min(100, Math.max(0, focus.x)) * 10) / 10,
      y: Math.round(Math.min(100, Math.max(0, focus.y)) * 10) / 10,
    };
  } else {
    delete entry.focus;
  }

  if (Object.keys(entry).length === 0) delete meta[name];
  else meta[name] = entry;

  await writeMeta(dir, meta);
}

/** Nur die Bilder, die die Diashow tatsächlich zeigen soll. */
export async function activePhotos(): Promise<PhotoItem[]> {
  const library = await listPhotos();
  return library.photos.filter((photo) => photo.selected);
}

/* -------------------------------------------------------------------------- */
/* Google Photos Picker                                                       */
/* -------------------------------------------------------------------------- */

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/**
 * Einen sicheren, kollisionsfreien Dateinamen bauen.
 *
 * Der von Google gelieferte Dateiname ist nur Kosmetik und wird bereinigt statt
 * uebernommen; die Endung kommt bewusst vom tatsaechlichen Content-Type der
 * heruntergeladenen Datei, nicht von Googles Angabe — `downloadPickerMediaFile`
 * erzwingt eine gerenderte JPEG-Version, unabhaengig vom Kameraformat.
 */
function safeGoogleFilename(item: PickerMediaItem, contentType: string): string {
  const rawStem = path.basename(item.filename, path.extname(item.filename));
  const stem = rawStem.replace(/[^\w-]+/g, '_').slice(0, 60) || 'photo';
  const id = item.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'image';
  const ext = CONTENT_TYPE_EXTENSIONS[contentType.split(';')[0]?.trim() ?? ''] ?? '.jpg';
  return `google-${id}-${stem}${ext}`;
}

export async function startGooglePickerSession(): Promise<GooglePickerSession> {
  return createPickerSession();
}

export async function googlePickerSessionStatus(sessionId: string): Promise<GooglePickerStatus> {
  return getPickerSessionStatus(sessionId);
}

/**
 * Die im Picker-Fenster gewaehlten Bilder herunterladen und wie lokale Bilder
 * behandeln — die Diashow braucht danach keinen Sonderweg fuer Google-Bilder.
 * Nur Fotos werden uebernommen, keine Videos (die Diashow zeigt nur Bilder).
 */
export async function importGooglePickerSession(sessionId: string): Promise<PhotoLibrary> {
  const dir = await resolveLocalDir();
  await fs.mkdir(dir, { recursive: true });

  const items = (await listPickerMediaItems(sessionId)).filter((item) => item.type === 'PHOTO');
  const meta = await readMeta(dir);

  for (const item of items) {
    try {
      const { buffer, contentType } = await downloadPickerMediaFile(item);
      const filename = safeGoogleFilename(item, contentType);
      // O_EXCL verhindert das Überschreiben bestehender Dateien oder Symlink-Ziele.
      await fs.writeFile(path.join(dir, filename), buffer, { flag: 'wx', mode: 0o600 }).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'EEXIST') throw error;
      });
      meta[filename] = { ...meta[filename], origin: 'google', takenAt: item.createTime };
    } catch (error) {
      // Ein einzelnes fehlgeschlagenes Bild darf den Rest des Imports nicht kippen.
      console.warn(`[photos] Google-Bild ${item.id} nicht ladbar: ${describeError(error)}`);
    }
  }

  await writeMeta(dir, meta);
  await deletePickerSession(sessionId);

  return listPhotos();
}

export async function cancelGooglePickerSession(sessionId: string): Promise<void> {
  await deletePickerSession(sessionId);
}
