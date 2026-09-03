import type { SlideTransition } from '@shared/types';

/**
 * Übergänge der Diashow.
 *
 * Ein gemeinsamer Stil hält sie zusammen: ruhig, lang, ohne Sprünge —
 * dieselbe Kurve wie im übrigen Dashboard (`ease-calm`), Dauern zwischen 1,1
 * und 2,4 Sekunden. Nichts blitzt, nichts dreht sich; ein Panel im Flur soll
 * nicht die Aufmerksamkeit fordern, sondern sie freigeben.
 *
 * Jeder Effekt beschreibt nur, wie das NEUE Bild hereinkommt und wie das alte
 * geht. Umgesetzt wird das über zwei übereinanderliegende Ebenen.
 */

export interface TransitionSpec {
  id: SlideTransition;
  /** Beschriftung in den Einstellungen. */
  label: string;
  /** Kurze Erklärung, was passiert. */
  hint: string;
  /** Dauer in Millisekunden. */
  duration: number;
  /** CSS-Animation der eintretenden Ebene. */
  enter: string;
  /** CSS-Animation der weichenden Ebene; leer = bleibt einfach liegen. */
  leave: string;
}

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export const TRANSITIONS: TransitionSpec[] = [
  {
    id: 'fade',
    label: 'Überblenden',
    hint: 'Das neue Bild wird weich sichtbar.',
    duration: 1400,
    enter: `tr-fade-in 1400ms ${EASE} both`,
    leave: `tr-fade-out 1400ms ${EASE} both`,
  },
  {
    id: 'fade-zoom',
    label: 'Überblenden mit Zoom',
    hint: 'Blendet auf und wächst dabei leicht.',
    duration: 1600,
    enter: `tr-fade-zoom-in 1600ms ${EASE} both`,
    leave: `tr-fade-zoom-out 1600ms ${EASE} both`,
  },
  {
    id: 'ken-burns',
    label: 'Ken Burns',
    hint: 'Langsame Fahrt über das Bild, überblendet.',
    duration: 1800,
    // Platzhalter — transitionSpec() setzt die echte Dauer anhand des
    // Wechselintervalls ein, siehe dort. Ohne Angabe: 24s Standardwert.
    enter: `tr-fade-in 1800ms ${EASE} both, tr-kenburns 24s linear both`,
    leave: `tr-fade-out 1800ms ${EASE} both`,
  },
  {
    id: 'blur-fade',
    label: 'Weichzeichnen',
    hint: 'Kommt unscharf herein und wird scharf.',
    duration: 1600,
    enter: `tr-blur-in 1600ms ${EASE} both`,
    leave: `tr-blur-out 1600ms ${EASE} both`,
  },
  {
    id: 'glow-dissolve',
    label: 'Ember-Auflösung',
    hint: 'Ein warmer Schimmer trägt das Bild herein.',
    duration: 1800,
    enter: `tr-glow-in 1800ms ${EASE} both`,
    leave: `tr-fade-out 1200ms ${EASE} both`,
  },
  {
    id: 'slide-left',
    label: 'Schieben nach links',
    hint: 'Das neue Bild kommt von rechts.',
    duration: 1300,
    enter: `tr-slide-in-right 1300ms ${EASE} both`,
    leave: `tr-fade-out 1300ms ${EASE} both`,
  },
  {
    id: 'slide-right',
    label: 'Schieben nach rechts',
    hint: 'Das neue Bild kommt von links.',
    duration: 1300,
    enter: `tr-slide-in-left 1300ms ${EASE} both`,
    leave: `tr-fade-out 1300ms ${EASE} both`,
  },
  {
    id: 'slide-up',
    label: 'Schieben nach oben',
    hint: 'Das neue Bild kommt von unten.',
    duration: 1300,
    enter: `tr-slide-in-bottom 1300ms ${EASE} both`,
    leave: `tr-fade-out 1300ms ${EASE} both`,
  },
  {
    id: 'slide-down',
    label: 'Schieben nach unten',
    hint: 'Das neue Bild kommt von oben.',
    duration: 1300,
    enter: `tr-slide-in-top 1300ms ${EASE} both`,
    leave: `tr-fade-out 1300ms ${EASE} both`,
  },
  {
    id: 'push-left',
    label: 'Verdrängen seitlich',
    hint: 'Das alte Bild wird nach links hinausgeschoben.',
    duration: 1500,
    enter: `tr-slide-in-right 1500ms ${EASE} both`,
    leave: `tr-push-out-left 1500ms ${EASE} both`,
  },
  {
    id: 'push-up',
    label: 'Verdrängen nach oben',
    hint: 'Das alte Bild wandert nach oben hinaus.',
    duration: 1500,
    enter: `tr-slide-in-bottom 1500ms ${EASE} both`,
    leave: `tr-push-out-up 1500ms ${EASE} both`,
  },
  {
    id: 'wipe-left',
    label: 'Wischen nach links',
    hint: 'Eine Kante fährt von rechts über das Bild.',
    duration: 1500,
    enter: `tr-wipe-left 1500ms ${EASE} both`,
    leave: '',
  },
  {
    id: 'wipe-right',
    label: 'Wischen nach rechts',
    hint: 'Eine Kante fährt von links über das Bild.',
    duration: 1500,
    enter: `tr-wipe-right 1500ms ${EASE} both`,
    leave: '',
  },
  {
    id: 'wipe-up',
    label: 'Wischen nach oben',
    hint: 'Eine Kante fährt von unten herauf.',
    duration: 1500,
    enter: `tr-wipe-up 1500ms ${EASE} both`,
    leave: '',
  },
  {
    id: 'wipe-diagonal',
    label: 'Wischen diagonal',
    hint: 'Eine schräge Kante zieht über das Bild.',
    duration: 1700,
    enter: `tr-wipe-diagonal 1700ms ${EASE} both`,
    leave: '',
  },
  {
    id: 'wipe-circle',
    label: 'Kreisblende',
    hint: 'Das neue Bild öffnet sich aus der Mitte.',
    duration: 1700,
    enter: `tr-wipe-circle 1700ms ${EASE} both`,
    leave: '',
  },
  {
    id: 'blinds-vertical',
    label: 'Lamellen senkrecht',
    hint: 'Senkrechte Streifen öffnen sich nacheinander.',
    duration: 1800,
    enter: `tr-blinds-v 1800ms ${EASE} both`,
    leave: '',
  },
  {
    id: 'blinds-horizontal',
    label: 'Lamellen waagerecht',
    hint: 'Waagerechte Streifen öffnen sich nacheinander.',
    duration: 1800,
    enter: `tr-blinds-h 1800ms ${EASE} both`,
    leave: '',
  },
  {
    id: 'shutter',
    label: 'Blende',
    hint: 'Öffnet sich von oben und unten zur Mitte.',
    duration: 1600,
    enter: `tr-shutter 1600ms ${EASE} both`,
    leave: '',
  },
  {
    id: 'scanline',
    label: 'Abtastzeile',
    hint: 'Eine Ember-Linie schreibt das Bild auf — Rubicon-typisch.',
    duration: 2400,
    enter: `tr-scanline 2400ms linear both`,
    leave: `tr-fade-out 2400ms ${EASE} both`,
  },
];

export const TRANSITION_BY_ID = new Map(TRANSITIONS.map((entry) => [entry.id, entry]));

/**
 * Bei Ken Burns die 24s-Platzhalterdauer durch das tatsächliche
 * Wechselintervall ersetzen.
 *
 * Ohne das lief die Fahrt über eine feste Dauer, unabhängig davon, wie lange
 * ein Bild überhaupt zu sehen war — bei kürzeren Intervallen wechselte das
 * Bild, bevor die Bewegung spürbar wurde, bei längeren blieb sie am Ende
 * einfach stehen.
 */
function withIntervalDuration(spec: TransitionSpec, intervalSeconds?: number): TransitionSpec {
  if (spec.id !== 'ken-burns' || !intervalSeconds) return spec;
  const seconds = Math.max(4, intervalSeconds);
  return { ...spec, enter: spec.enter.replace('24s', `${seconds}s`) };
}

export function transitionSpec(id: SlideTransition, intervalSeconds?: number): TransitionSpec {
  const spec = TRANSITION_BY_ID.get(id) ?? (TRANSITIONS[0] as TransitionSpec);
  return withIntervalDuration(spec, intervalSeconds);
}

/** Zufälliger Effekt — für den Modus "bei jedem Wechsel ein anderer". */
export function randomTransition(exclude?: SlideTransition, intervalSeconds?: number): TransitionSpec {
  const pool = TRANSITIONS.filter((entry) => entry.id !== exclude);
  const spec = pool[Math.floor(Math.random() * pool.length)] as TransitionSpec;
  return withIntervalDuration(spec, intervalSeconds);
}
