/** Typen fuer die zentrale Theme-Datei (tokens.js). */
import type { FontPairingId, ThemeMode, TrashKind } from '@shared/types';

export interface AccentPalette {
  base: string;
  soft: string;
  hot: string;
  dim: string;
}

/** Alle Theme-Modi außer "custom" — dafür gibt es keine feste Palette, siehe deriveAccentShades(). */
export type NamedThemeMode = Exclude<ThemeMode, 'custom'>;

export interface FontPairing {
  label: string;
  hint: string;
  sans: string;
  mono: string;
}

export interface ThemePreset {
  id: NamedThemeMode;
  label: string;
  hint: string;
  fontPairing: FontPairingId;
}

export declare const surface: Record<'300' | '400' | '500' | '600' | '700' | '800' | '900', string>;
export declare const accents: Record<NamedThemeMode, AccentPalette>;
export declare const themeLabels: Record<NamedThemeMode, string>;
export declare const fontPairings: Record<FontPairingId, FontPairing>;
export declare const themePresets: ThemePreset[];
export declare const signal: Record<'ok' | 'warn' | 'err' | 'info' | 'idle', string>;
export declare const calendarPalette: string[];
export declare const trashPalette: Record<TrashKind, string>;
export declare const backgrounds: Array<{ file: string; label: string }>;
export declare const shadows: Record<'panel' | 'tile' | 'glow' | 'press', string>;

declare const tokens: {
  surface: typeof surface;
  accents: typeof accents;
  themeLabels: typeof themeLabels;
  fontPairings: typeof fontPairings;
  themePresets: typeof themePresets;
  signal: typeof signal;
  calendarPalette: typeof calendarPalette;
  trashPalette: typeof trashPalette;
  backgrounds: typeof backgrounds;
  shadows: typeof shadows;
};
export default tokens;
