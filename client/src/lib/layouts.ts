import type { LayoutColumn, LayoutPresetId } from '@shared/types';

/**
 * Fertige Anordnungen des Dashboard-Rasters.
 *
 * Jede Vorlage ist eine Liste von Spalten; `span` ist die Breite im
 * 12er-Raster, die Summe ergibt immer 12. Innerhalb einer Spalte stehen die
 * Panels von oben nach unten.
 *
 * Die Auswahl ist bewusst nach Situationen geschnitten, nicht nach
 * Geschmacksvarianten derselben Aufteilung: Wer den Kalender als Wandkalender
 * will, wer morgens den Tagesplan liest, wer in der Küche steht — das sind
 * verschiedene Geräte am selben Code. Reine Spiegelungen („Wetter mal links,
 * mal rechts") sind absichtlich nicht dabei, die tragen nichts bei.
 */
export interface LayoutPreset {
  id: Exclude<LayoutPresetId, 'custom'>;
  label: string;
  hint: string;
  columns: LayoutColumn[];
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'standard',
    label: 'Standard',
    hint: 'Tagesplan und Müll links, Kalender in der Mitte, Wetter rechts.',
    columns: [
      { span: 3, panels: ['agenda', 'trash'] },
      { span: 6, panels: ['calendar'] },
      { span: 3, panels: ['weather'] },
    ],
  },
  {
    id: 'kalender-gross',
    label: 'Kalender groß',
    hint: 'Der Kalender bekommt fast alles — für den Monatsblick an der Wand.',
    columns: [
      { span: 9, panels: ['calendar'] },
      { span: 3, panels: ['agenda', 'trash', 'weather'] },
    ],
  },
  {
    id: 'zwei-spalten',
    label: 'Zwei Spalten',
    hint: 'Nur Tagesplan und Kalender, beide gleich breit. Ruhigste Variante.',
    columns: [
      { span: 6, panels: ['agenda', 'trash'] },
      { span: 6, panels: ['calendar'] },
    ],
  },
  {
    id: 'tagesplan',
    label: 'Tagesplan',
    hint: 'Was heute ansteht, groß. Kalender und Wetter nur als Beiwerk.',
    columns: [
      { span: 6, panels: ['agenda'] },
      { span: 3, panels: ['calendar'] },
      { span: 3, panels: ['weather', 'trash'] },
    ],
  },
  {
    id: 'wetterstation',
    label: 'Wetterstation',
    hint: 'Wetter vorn, dazu Messwerte aus dem Haus. Für Fensterplätze.',
    columns: [
      { span: 5, panels: ['weather'] },
      { span: 4, panels: ['calendar'] },
      { span: 3, panels: ['trash', 'sensors'] },
    ],
  },
  {
    id: 'smart-home',
    label: 'Smart Home',
    hint: 'Schnellaktionen und Messwerte dauerhaft sichtbar statt im Fenster.',
    columns: [
      { span: 3, panels: ['agenda', 'trash'] },
      { span: 5, panels: ['calendar'] },
      { span: 4, panels: ['smarthome', 'sensors'] },
    ],
  },
  {
    id: 'kueche',
    label: 'Küche',
    hint: 'Einkaufsliste dauerhaft offen, daneben Termine und Wetter.',
    columns: [
      { span: 4, panels: ['lists'] },
      { span: 4, panels: ['agenda', 'trash'] },
      { span: 4, panels: ['weather'] },
    ],
  },
  {
    id: 'nur-kalender',
    label: 'Nur Kalender',
    hint: 'Alles andere liegt in der Startleiste. Maximale Fläche für Termine.',
    columns: [{ span: 12, panels: ['calendar'] }],
  },
  {
    id: 'uebersicht',
    label: 'Alles auf einen Blick',
    hint: 'Vier schmale Spalten — dicht, aber nichts muss angetippt werden.',
    columns: [
      { span: 3, panels: ['agenda', 'trash'] },
      { span: 4, panels: ['calendar'] },
      { span: 2, panels: ['weather'] },
      { span: 3, panels: ['sensors', 'smarthome'] },
    ],
  },
  {
    id: 'assistent',
    label: 'Assistent',
    hint: 'Der AI-Assistent steht fest rechts, statt sich erst zu öffnen.',
    columns: [
      { span: 3, panels: ['agenda', 'trash'] },
      { span: 5, panels: ['calendar'] },
      { span: 4, panels: ['assistant'] },
    ],
  },
];

/** Vorlage nachschlagen; unbekannte Kennung fällt auf Standard zurück. */
export function presetColumns(id: LayoutPresetId): LayoutColumn[] {
  const treffer = LAYOUT_PRESETS.find((vorlage) => vorlage.id === id);
  return (treffer ?? LAYOUT_PRESETS[0]!).columns;
}
