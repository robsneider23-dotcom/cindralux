import type { TrashKind } from '../../../shared/types.ts';

/**
 * Farben der Tonnenarten.
 *
 * Liegt serverseitig, weil auch aus einer ICS-Quelle stammende Termine eine
 * Farbe brauchen — dort gibt es keine vom Nutzer gepflegte Regel.
 * Gleiche Werte wie in client/src/theme/tokens.js.
 */
export const trashPalette: Record<TrashKind, string> = {
  restmuell: '#a1a1aa',
  bio: '#84cc16',
  papier: '#38bdf8',
  'gelber-sack': '#fbbf24',
  glas: '#2dd4bf',
  sperrmuell: '#c084fc',
};
