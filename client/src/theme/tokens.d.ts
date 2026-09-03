/** Typen fuer die zentrale Theme-Datei (tokens.js). */
import type { ThemeMode, TrashKind } from '@shared/types';

export interface AccentPalette {
  base: string;
  soft: string;
  hot: string;
  dim: string;
}

export declare const surface: Record<'300' | '400' | '500' | '600' | '700' | '800' | '900', string>;
export declare const accents: Record<ThemeMode, AccentPalette>;
export declare const signal: Record<'ok' | 'warn' | 'err' | 'info' | 'idle', string>;
export declare const calendarPalette: string[];
export declare const trashPalette: Record<TrashKind, string>;
export declare const backgrounds: Array<{ file: string; label: string }>;
export declare const shadows: Record<'panel' | 'tile' | 'glow' | 'press', string>;

declare const tokens: {
  surface: typeof surface;
  accents: typeof accents;
  signal: typeof signal;
  calendarPalette: typeof calendarPalette;
  trashPalette: typeof trashPalette;
  backgrounds: typeof backgrounds;
  shadows: typeof shadows;
};
export default tokens;
