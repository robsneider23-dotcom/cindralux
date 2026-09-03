import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Duenne Kapselung um JSON-Dateien. Schreibvorgaenge laufen atomar
 * (temporaere Datei + rename), damit ein Stromausfall am Pi keine halb
 * geschriebene config.json hinterlaesst.
 */

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return null;
    if (error instanceof SyntaxError) {
      console.warn(`[store] ${path.basename(file)} ist kein gueltiges JSON — wird ignoriert.`);
      return null;
    }
    throw error;
  }
}

export async function writeJson(file: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, file);
}
