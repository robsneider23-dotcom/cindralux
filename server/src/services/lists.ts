import path from 'node:path';
import type {
  CreateNoteRequest,
  CreateShoppingItemRequest,
  ListsResponse,
  NoteItem,
  ShoppingItem,
} from '../../../shared/types.ts';
import { DATA_DIR } from '../lib/paths.ts';
import { readJson, writeJson } from '../lib/jsonStore.ts';
import { describeError } from '../lib/http.ts';

/**
 * Einkaufsliste und Notizen.
 *
 * Beide sind bewusst schlicht gehalten — kurze Zeilen, kein Formatieren,
 * keine Kategorien. Gespeichert wird in data/lists.json, damit ein Neustart
 * des Pi die Liste nicht verschluckt.
 */

const LISTS_FILE = path.join(DATA_DIR, 'lists.json');
const MAX_TEXT_LENGTH = 200;
/** Schuetzt vor einer grenzenlos wachsenden Datei bei versehentlicher Dauereingabe. */
const MAX_ITEMS_PER_LIST = 200;

interface ListsStore {
  shopping: ShoppingItem[];
  notes: NoteItem[];
}

let store: ListsStore | null = null;

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

async function load(): Promise<ListsStore> {
  if (store) return store;
  const stored = await readJson<ListsStore>(LISTS_FILE);
  store = { shopping: stored?.shopping ?? [], notes: stored?.notes ?? [] };
  return store;
}

async function persist(): Promise<void> {
  await writeJson(LISTS_FILE, store).catch((error) => {
    console.warn(`[lists] Konnte nicht gespeichert werden: ${describeError(error)}`);
  });
}

/** Leerzeichen trimmen, Laenge begrenzen — sonst nichts. Wirft bei leerem Text. */
function normalizeText(raw: string): string {
  const text = raw.trim();
  if (!text) throw new Error('Text darf nicht leer sein');
  return text.slice(0, MAX_TEXT_LENGTH);
}

export async function getLists(): Promise<ListsResponse> {
  const current = await load();
  return { shopping: current.shopping, notes: current.notes };
}

export async function addShoppingItem(request: CreateShoppingItemRequest): Promise<ShoppingItem> {
  const current = await load();
  const item: ShoppingItem = {
    id: nextId('sh'),
    text: normalizeText(request.text ?? ''),
    done: false,
    createdAt: new Date().toISOString(),
  };
  current.shopping.push(item);
  // Aelteste zuerst raus, nicht die zuletzt eingetragenen.
  if (current.shopping.length > MAX_ITEMS_PER_LIST) current.shopping.shift();
  await persist();
  return item;
}

export async function toggleShoppingItem(id: string): Promise<ShoppingItem | null> {
  const current = await load();
  const item = current.shopping.find((entry) => entry.id === id);
  if (!item) return null;
  item.done = !item.done;
  await persist();
  return item;
}

export async function deleteShoppingItem(id: string): Promise<boolean> {
  const current = await load();
  const next = current.shopping.filter((entry) => entry.id !== id);
  const removed = next.length !== current.shopping.length;
  current.shopping = next;
  if (removed) await persist();
  return removed;
}

/** Abgehakte Eintraege auf einmal raeumen — fuer den "Erledigte loeschen"-Knopf. */
export async function clearCheckedShoppingItems(): Promise<number> {
  const current = await load();
  const before = current.shopping.length;
  current.shopping = current.shopping.filter((entry) => !entry.done);
  const removed = before - current.shopping.length;
  if (removed > 0) await persist();
  return removed;
}

export async function addNote(request: CreateNoteRequest): Promise<NoteItem> {
  const current = await load();
  const note: NoteItem = {
    id: nextId('nt'),
    text: normalizeText(request.text ?? ''),
    createdAt: new Date().toISOString(),
  };
  current.notes.push(note);
  if (current.notes.length > MAX_ITEMS_PER_LIST) current.notes.shift();
  await persist();
  return note;
}

export async function deleteNote(id: string): Promise<boolean> {
  const current = await load();
  const next = current.notes.filter((entry) => entry.id !== id);
  const removed = next.length !== current.notes.length;
  current.notes = next;
  if (removed) await persist();
  return removed;
}
