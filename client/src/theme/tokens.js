/**
 * Zentrale Theme-Datei — einzige Quelle fuer Farben, Schatten und Akzente.
 *
 * Bewusst reines JavaScript, damit sowohl `tailwind.config.js` als auch der
 * TypeScript-Code dieselben Werte lesen. Wer die Optik aendern will, aendert
 * ausschliesslich diese Datei.
 */

/** Grundflaechen — von der tiefsten Ebene bis zur obersten Kachel. */
export const surface = {
  900: '#050505',
  800: '#080808',
  700: '#0d0d0d',
  600: '#111111',
  500: '#161616',
  400: '#1c1c1c',
  300: '#242424',
};

/**
 * Die drei Theme-Modi. `ember` ist der Rubicon-Standard, `crimson` faellt
 * tiefer ins Rot, `graphite` nimmt die Farbe fast ganz zurueck.
 */
export const accents = {
  ember: { base: '#ff5a1f', soft: '#ff8a52', hot: '#ff3c12', dim: '#a8360f' },
  crimson: { base: '#e11d48', soft: '#fb7185', hot: '#be123c', dim: '#881337' },
  graphite: { base: '#94a3b8', soft: '#cbd5e1', hot: '#64748b', dim: '#475569' },
};

/** Statusfarben — bewusst kuehl, damit Ember die einzige warme Farbe bleibt. */
export const signal = {
  ok: '#34d399',
  warn: '#fbbf24',
  err: '#f43f5e',
  info: '#22d3ee',
  idle: '#71717a',
};

/** Vorschlaege fuer neue Kalenderquellen in den Einstellungen. */
export const calendarPalette = [
  '#ff5a1f',
  '#22d3ee',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
  '#f472b6',
  '#38bdf8',
  '#fb923c',
];

/** Farben der Muelltonnen-Arten. */
export const trashPalette = {
  restmuell: '#a1a1aa',
  bio: '#84cc16',
  papier: '#38bdf8',
  'gelber-sack': '#fbbf24',
  glas: '#2dd4bf',
  sperrmuell: '#c084fc',
};

/** Auswaehlbare Hintergruende — siehe assets/rubicon/README.md. */
export const backgrounds = [
  { file: 'backdrop-topo.svg', label: 'Topografie' },
  { file: 'backdrop-waves.svg', label: 'Wellen' },
  { file: 'backdrop-grid.svg', label: 'Raster' },
  { file: '', label: 'Ohne' },
];

export const shadows = {
  panel:
    'inset 0 1px 0 0 rgba(255,255,255,0.05), inset 0 -30px 50px -40px rgba(0,0,0,1), 0 28px 70px -45px rgba(0,0,0,1)',
  tile: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 18px 40px -28px rgba(0,0,0,0.95)',
  glow: '0 0 0 1px rgba(255,90,31,0.28), 0 0 34px -8px rgba(255,90,31,0.5)',
  press: 'inset 0 2px 12px -2px rgba(0,0,0,0.9)',
};

export default { surface, accents, signal, calendarPalette, trashPalette, backgrounds, shadows };
