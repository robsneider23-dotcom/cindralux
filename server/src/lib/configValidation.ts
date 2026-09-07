import { z } from 'zod';
import type { AppConfig, AppConfigPatch } from '../../../shared/types.ts';
import { safeHttpUrl } from './http.ts';
import { assertSafeJson } from './security.ts';

const text = z.string().max(4000);
const id = z.string().min(1).max(200).refine((value) => !['__proto__', 'constructor', 'prototype'].includes(value));
const color = z.string().regex(/^#[\da-f]{6}$/i);
const service = z.string().regex(/^[a-z0-9_]+$/).max(100);
const entity = z.string().regex(/^(?:all|[a-z0-9_]+\.[a-z0-9_]+)$/).max(200);
const url = text.refine((value) => {
  if (!value || value === '__clear__') return true;
  try { safeHttpUrl(value.replace(/^webcal:\/\//i, 'https://'), true); return true; } catch { return false; }
}, 'Ungültige HTTP(S)-Adresse.');
const panel = z.enum(['agenda', 'trash', 'calendar', 'weather', 'smarthome', 'sensors', 'assistant', 'lists']);
const arrays: Record<string, z.ZodType> = {
  calendars: z.array(z.object({
    id, name: text, color, url: url.optional().default(''), enabled: z.boolean(),
    account: text.optional(), provider: z.enum(['ics', 'google', 'google-api']).optional(), googleCalendarId: text.optional(),
  })).max(100).refine((items) => new Set(items.map((item) => item.id)).size === items.length, 'Kalender-IDs müssen eindeutig sein.'),
  trashRules: z.array(z.object({
    id, kind: z.enum(['restmuell', 'bio', 'papier', 'gelber-sack', 'glas', 'sperrmuell']), label: text, color,
    weekday: z.number().int().min(0).max(6), everyNWeeks: z.number().int().min(1).max(52),
    anchorDate: z.iso.date(), enabled: z.boolean(),
  })).max(100),
  smartHomeActions: z.array(z.object({
    id, label: text, hint: text.optional(), icon: z.enum(['power-off', 'lamp', 'kitchen', 'movie', 'night', 'blinds', 'heating', 'music', 'coffee', 'lock']), kind: z.enum(['toggle', 'scene']), domain: service, service,
    serviceOff: service.optional(), entityId: entity.optional(), serviceData: z.record(z.string(), z.json()).optional(), accent: color.optional(),
  })).max(100),
  sensors: z.array(z.object({
    id, label: text, entityId: entity, icon: z.enum(['temperature', 'humidity', 'window', 'door', 'power', 'solar', 'battery', 'motion', 'water', 'washer', 'presence', 'generic']), unit: text.optional(), decimals: z.number().int().min(0).max(10).optional(),
    alertStates: z.array(text).max(50).optional(), enabled: z.boolean(),
  })).max(100),
  'layout.custom': z.array(z.object({ span: z.number().int().min(1).max(12), panels: z.array(panel).max(8) })).max(12)
    .refine((columns) => !columns.length || columns.reduce((sum, column) => sum + column.span, 0) === 12, 'Spaltenbreiten müssen zusammen 12 ergeben.')
    .refine((columns) => { const ids = columns.flatMap((column) => column.panels); return new Set(ids).size === ids.length; }, 'Panels dürfen nur einmal vorkommen.'),
  'photos.selected': z.array(z.string().max(512)).max(10000),
};
const enums: Record<string, [string, ...string[]]> = {
  'trash.source': ['rules', 'ics'],
  'calendarView.defaultView': ['tag', 'woche', 'monat'],
  'ai.gptLive.mode': ['browser-tab', 'local-command'],
  'appearance.themeMode': ['ember', 'crimson', 'graphite', 'mint', 'violet', 'amber', 'slate', 'rose', 'custom'],
  'appearance.fontPairing': ['standard', 'grotesk', 'sora', 'manrope', 'public', 'outfit'],
  'appearance.colorScheme': ['dark', 'light', 'auto'],
  'appearance.onScreenKeyboard': ['off', 'auto', 'always'],
  'layout.preset': ['standard', 'kalender-gross', 'zwei-spalten', 'tagesplan', 'wetterstation', 'smart-home', 'kueche', 'nur-kalender', 'uebersicht', 'assistent', 'custom'],
  'idle.slideshow.source': ['local', 'google', 'both'],
  'idle.slideshow.order': ['mix', 'date', 'person'],
  'idle.slideshow.transition': ['fade', 'fade-zoom', 'ken-burns', 'blur-fade', 'glow-dissolve', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'push-left', 'push-up', 'wipe-left', 'wipe-right', 'wipe-up', 'wipe-diagonal', 'wipe-circle', 'blinds-vertical', 'blinds-horizontal', 'shutter', 'scanline'],
};
const bounds: Record<string, [number, number]> = {
  calendarRefreshMinutes: [1, 1440], 'calendarView.autoReturnMinutes': [0, 1440],
  'weather.latitude': [-90, 90], 'weather.longitude': [-180, 180],
  'appearance.backgroundOpacity': [0, 1], 'appearance.night.dimLevel': [0.05, 1],
  'appearance.night.startHour': [0, 23], 'appearance.night.endHour': [0, 23],
  'appearance.night.wakeSeconds': [5, 86400], 'idle.afterSeconds': [15, 86400], 'idle.slideshow.intervalSeconds': [3, 86400],
};

function schema(reference: unknown, path = ''): z.ZodType {
  if (arrays[path]) return arrays[path];
  if (enums[path]) return z.enum(enums[path]);
  if (path.startsWith('appearance.windowBackdrops.')) return z.enum(['none', 'timeline', 'grid', 'drift', 'breathe', 'pulse', 'sweep', 'orbit', 'ring', 'rain', 'embers']);
  if (typeof reference === 'boolean') return z.boolean();
  if (typeof reference === 'number') {
    const [min, max] = bounds[path] ?? [0, 100000];
    const numeric = z.number().finite().min(min).max(max);
    return ['appearance.night.startHour', 'appearance.night.endHour'].includes(path) ? numeric.int() : numeric;
  }
  if (typeof reference === 'string') {
    if (/(?:baseUrl|sessionUrl|callUrl|icsUrl)$/.test(path) || path === 'ai.gptLive.url') return url;
    if (path === 'trash.icsContent') return z.string().max(200000);
    if (path === 'ai.systemPrompt') return z.string().max(20000);
    if (path === 'appearance.background') return z.string().max(200).regex(/^[\w.-]*$/);
    if (path === 'appearance.customAccent') return color.or(z.literal(''));
    if (path === 'weather.timezone') return text.refine((value) => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } });
    return text;
  }
  if (Array.isArray(reference)) throw new Error(`Fehlendes Konfigurationsschema: ${path}`);
  return z.object(Object.fromEntries(Object.entries(reference as Record<string, unknown>).map(([key, value]) => [key, schema(value, path ? `${path}.${key}` : key).optional()])));
}

export function validateConfigPatch(patch: unknown, defaults: AppConfig): AppConfigPatch {
  assertSafeJson(patch);
  return schema(defaults).parse(patch) as AppConfigPatch;
}
