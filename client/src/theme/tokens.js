/**
 * Zentrale Theme-Datei — einzige Quelle fuer Farben, Schatten und Akzente.
 *
 * Bewusst reines JavaScript, damit sowohl `tailwind.config.js` als auch der
 * TypeScript-Code dieselben Werte lesen. Wer die Optik aendern will, aendert
 * ausschliesslich diese Datei.
 */

/** Grundflaechen — von der tiefsten Ebene bis zur obersten Kachel. */
export const surface = {
  900: '#0a0c0f',
  800: '#0e1014',
  700: '#13161b',
  600: '#181b21',
  500: '#1d2127',
  400: '#24282f',
  300: '#2d323a',
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

/**
 * Design-Richtungen (appearance.skin): feste Gesamtpakete aus Akzentfarbe,
 * Schriftpaarung und Hell/Dunkel-Modus. Anders als `themePresets` bleiben
 * diese Werte nicht einzeln nachjustierbar — store.tsx setzt sie komplett,
 * solange ein Skin aktiv ist (nicht "default"), und uebergeht dabei
 * `themeMode`/`fontPairing`/`colorScheme`. Die Flaechen- und Textfarben
 * (surface/ink/hairline/shade/signal) sowie die Panel-Optik kommen aus
 * `theme/skins.css` (`html[data-skin="…"]`); hier stehen nur die Werte, die
 * store.tsx weiterhin inline setzen muss (Akzent, Schrift — wie bei
 * themeMode/fontPairing schlagen Inline-Styles jede Stylesheet-Regel).
 */
export const skins = {
  phosphor: {
    label: 'Phosphor', hint: 'Terminal/Konsole: Monospace, scharfe Kanten, Scanlines.', mode: 'dark',
    accent: { base: '#7cffb2', soft: '#4ade80', hot: '#a8ffcc' },
    fontSans: "'JetBrains Mono', ui-monospace, monospace", fontMono: "'JetBrains Mono', ui-monospace, monospace",
  },
  broadsheet: {
    label: 'Broadsheet', hint: 'Warmes Papier, Serifen-Headlines, Linien statt Kacheln.', mode: 'light',
    accent: { base: '#b5502e', soft: '#d97a54', hot: '#8a3a1f' },
    fontSans: "'Newsreader', Georgia, serif", fontMono: "'Work Sans', system-ui, sans-serif",
  },
  aurora: {
    label: 'Aurora', hint: 'Frostglas auf diffusem Farbverlauf, weich und raeumlich.', mode: 'dark',
    accent: { base: '#c9b6ff', soft: '#7dd3fc', hot: '#e879f9' },
    fontSans: "'Sora', system-ui, sans-serif", fontMono: "'Manrope', system-ui, sans-serif",
  },
  schema: {
    label: 'Schema', hint: 'Blaupause mit Rasterlinien und Eckklammern.', mode: 'dark',
    accent: { base: '#7dd3fc', soft: '#38bdf8', hot: '#bae6fd' },
    fontSans: "'Space Grotesk', system-ui, sans-serif", fontMono: "'IBM Plex Mono', ui-monospace, monospace",
  },
  'dusk-garden': {
    label: 'Dusk Garden', hint: 'Warmer Daemmerlicht-Verlauf, kursive Serifenzahlen.', mode: 'dark',
    accent: { base: '#e2a97f', soft: '#c98a5e', hot: '#f0c29c' },
    fontSans: "'Instrument Serif', Georgia, serif", fontMono: "'Outfit', system-ui, sans-serif",
  },
  herbarium: {
    label: 'Herbarium', hint: 'Botanisches Linienbild, Herbarkarten-Optik, gedeckte Farben.', mode: 'light',
    accent: { base: '#a8654a', soft: '#c98a7a', hot: '#7d4a35' },
    fontSans: "'EB Garamond', Georgia, serif", fontMono: "'Karla', system-ui, sans-serif",
  },
  chintz: {
    label: 'Chintz', hint: 'Viktorianische Tapete, Doppelrahmen, Smaragd/Gold/Wein.', mode: 'dark',
    accent: { base: '#efc978', soft: '#d8ad5a', hot: '#ff8fa3' },
    fontSans: "'Playfair Display', Georgia, serif", fontMono: "'Jost', system-ui, sans-serif",
  },
  greenhouse: {
    label: 'Greenhouse', hint: 'Modernes Pflanzenladen-Gefuehl, frisches Gruen auf Weiss.', mode: 'light',
    accent: { base: '#2f8f5b', soft: '#4ba876', hot: '#1f6e43' },
    fontSans: "'Plus Jakarta Sans', system-ui, sans-serif", fontMono: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  'petal-wash': {
    label: 'Petal Wash', hint: 'Aquarell-Pastell, weich verlaufende Bluetentoene.', mode: 'light',
    accent: { base: '#c2708f', soft: '#d98fab', hot: '#a5567a' },
    fontSans: "'Quicksand', system-ui, sans-serif", fontMono: "'Mulish', system-ui, sans-serif",
  },
  ikebana: {
    label: 'Ikebana', hint: 'Japanische Zurueckhaltung, ein Kirschbluetenzweig, viel Leere.', mode: 'light',
    accent: { base: '#a83c3c', soft: '#c26060', hot: '#822a2a' },
    fontSans: "'Shippori Mincho', Georgia, serif", fontMono: "'Zen Kaku Gothic New', system-ui, sans-serif",
  },
  cockpit: {
    label: 'Cockpit', hint: 'Sci-Fi-HUD, angeschnittene Ecken, Cyan/Magenta-Glow.', mode: 'dark',
    accent: { base: '#35e0ff', soft: '#7deeff', hot: '#ff3df0' },
    fontSans: "'Rajdhani', system-ui, sans-serif", fontMono: "'Orbitron', sans-serif",
  },
  neumorph: {
    label: 'Neumorph', hint: 'Weiches gepraegtes Geraetepanel, ein Neon-Akzent.', mode: 'light',
    accent: { base: '#3fa8ff', soft: '#6cc0ff', hot: '#1f8ae6' },
    fontSans: "'Urbanist', system-ui, sans-serif", fontMono: "'Urbanist', system-ui, sans-serif",
  },
  'neon-grid': {
    label: 'Neon Grid', hint: 'Cyberpunk, VHS-Scanlines, Pink/Cyan auf Schwarz.', mode: 'dark',
    accent: { base: '#00f0ff', soft: '#ff2ee0', hot: '#ff8bf1' },
    fontSans: "'Chakra Petch', system-ui, sans-serif", fontMono: "'Audiowide', sans-serif",
  },
  holoform: {
    label: 'Holoform', hint: 'Sehr helles Minimal-Futurismus, holografischer Schimmer.', mode: 'light',
    accent: { base: '#6b7ce8', soft: '#939fee', hot: '#4c5cc4' },
    fontSans: "'Hanken Grotesk', system-ui, sans-serif", fontMono: "'Unbounded', sans-serif",
  },
  circuit: {
    label: 'Circuit', hint: 'Platinenoptik, Leiterbahnen, Via-Punkte, Kupfer/Gruen.', mode: 'dark',
    accent: { base: '#4ade80', soft: '#86efac', hot: '#e0a458' },
    fontSans: "'Share Tech Mono', ui-monospace, monospace", fontMono: "'Share Tech Mono', ui-monospace, monospace",
  },
};

/** Reihenfolge der Skin-Kacheln in den Einstellungen. */
export const skinOrder = [
  'phosphor', 'broadsheet', 'aurora', 'schema', 'dusk-garden',
  'herbarium', 'chintz', 'greenhouse', 'petal-wash', 'ikebana',
  'cockpit', 'neumorph', 'neon-grid', 'holoform', 'circuit',
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
    'inset 0 1px 0 rgb(var(--hairline) / 0.035), 0 8px 28px -12px rgb(var(--shade) / 0.28)',
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
  skins,
  skinOrder,
  signal,
  calendarPalette,
  trashPalette,
  backgrounds,
  shadows,
};
