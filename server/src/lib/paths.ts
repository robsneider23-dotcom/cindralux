import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Projektwurzel — von server/src/lib aus drei Ebenen hoch. */
export const ROOT_DIR = path.resolve(here, '../../..');
export const DATA_DIR = process.env.CINDRALUX_DATA_DIR ? path.resolve(process.env.CINDRALUX_DATA_DIR) : path.join(ROOT_DIR, 'data');
export const SEEDS_DIR = path.join(ROOT_DIR, 'data', 'seeds');
export const CACHE_DIR = path.join(DATA_DIR, 'cache');
export const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
export const CLIENT_DIST_DIR = path.join(ROOT_DIR, 'client', 'dist');

export const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
export const CALENDAR_CACHE_FILE = path.join(CACHE_DIR, 'calendar.json');
