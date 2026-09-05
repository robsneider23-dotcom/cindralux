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
 * Die Theme-Modi. `ember` ist der Cindralux-Standard, `crimson` faellt tiefer
 * ins Rot, `graphite` nimmt die Farbe fast ganz zurueck. Die fuenf weiteren
 * sind eigene Richtungen, keine Varianten derselben Idee — jede zusammen mit
 * einer Schriftpaarung gedacht (siehe FONT_PAIRINGS), aber unabhaengig davon
 * waehlbar. `custom` ist nicht Teil dieser Tabelle: `deriveAccentShades()`
 * baut die vier Abstufungen dafuer zur Laufzeit aus einer selbst gewaehlten
 * Farbe.
 */
export const accents = {
  ember: { base: '#ff5a1f', soft: '#ff8a52', hot: '#ff3c12', dim: '#a8360f' },
  crimson: { base: '#e11d48', soft: '#fb7185', hot: '#be123c', dim: '#881337' },
  graphite: { base: '#94a3b8', soft: '#cbd5e1', hot: '#64748b', dim: '#475569' },
  mint: { base: '#2dd4bf', soft: '#5eead4', hot: '#14b8a6', dim: '#0f766e' },
  violet: { base: '#8b5cf6', soft: '#a78bfa', hot: '#7c3aed', dim: '#5b21b6' },
  amber: { base: '#d4a24e', soft: '#e8c07d', hot: '#b8860b', dim: '#8a6414' },
  slate: { base: '#60a5fa', soft: '#93c5fd', hot: '#3b82f6', dim: '#1d4ed8' },
  rose: { base: '#f472b6', soft: '#f9a8d4', hot: '#ec4899', dim: '#9d174d' },
};

/** Anzeigename je Theme-Modus, fuer die Kachelauswahl in den Einstellungen. */
export const themeLabels = {
  ember: 'Ember',
  crimson: 'Crimson',
  graphite: 'Graphit',
  mint: 'Mint',
  violet: 'Violett',
  amber: 'Amber',
  slate: 'Azurit',
  rose: 'Rose',
};

/**
 * Schriftpaarungen: eine Anzeigeschrift (Ueberschriften, Fliesstext) plus
 * eine Ziffernschrift (Uhr, Kalenderzeiten, Messwerte — dort zaehlt
 * Tabellensatz mehr als Charakter). Alle ueber Google Fonts geladen, siehe
 * client/index.html. Unabhaengig von der Akzentfarbe waehlbar.
 */
export const fontPairings = {
  standard: {
    label: 'Standard',
    hint: 'Inter, die heutige Schrift.',
    sans: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  grotesk: {
    label: 'Space Grotesk',
    hint: 'Kantig und technisch, wie ein Messgeraet.',
    sans: "'Space Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'Space Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  sora: {
    label: 'Sora',
    hint: 'Ruhig und rund, sehr gut lesbar aus der Distanz.',
    sans: "'Sora', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  manrope: {
    label: 'Manrope',
    hint: 'Warm und geometrisch zugleich.',
    sans: "'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  public: {
    label: 'Public Sans',
    hint: 'Nuechtern und sehr klar, fuer Behoerden entwickelt.',
    sans: "'Public Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  outfit: {
    label: 'Outfit',
    hint: 'Zeitgemaess und weich, mit viel Luft in den Formen.',
    sans: "'Outfit', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
};

/**
 * Fuenf fertige Design-Vorlagen: Akzentfarbe und Schriftpaarung in einem
 * Tipp. Beides bleibt trotzdem einzeln aenderbar — wer die Farbe von "Mint"
 * mag, aber lieber "Outfit" als Schrift haette, stellt das darunter separat
 * ein. Ember/Crimson/Graphit sind bewusst nicht als Vorlagen dabei: Sie
 * bestehen laenger als dieses Feature und behalten die Standardschrift, damit
 * sich fuer bestehende Installationen nichts von selbst aendert.
 */
export const themePresets = [
  { id: 'mint', label: 'Mint', hint: 'Kuehl und klar, wie ein Labor-Monitor.', fontPairing: 'grotesk' },
  { id: 'violet', label: 'Violett', hint: 'Satt und ruhig, etwas Feierliches.', fontPairing: 'sora' },
  { id: 'amber', label: 'Amber', hint: 'Warmes Messing statt Ember-Orange.', fontPairing: 'manrope' },
  { id: 'slate', label: 'Azurit', hint: 'Kuehles Blau, sehr zurueckhaltend.', fontPairing: 'public' },
  { id: 'rose', label: 'Rose', hint: 'Kraeftig und warm, ohne ins Rote zu fallen.', fontPairing: 'outfit' },
];

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

/** Auswaehlbare Hintergruende — siehe assets/cindralux/README.md. */
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

export default {
  surface,
  accents,
  themeLabels,
  fontPairings,
  themePresets,
  signal,
  calendarPalette,
  trashPalette,
  backgrounds,
  shadows,
};
