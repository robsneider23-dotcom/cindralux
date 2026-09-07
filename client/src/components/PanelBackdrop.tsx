import { cx } from '@/lib/utils';

/**
 * Ruhige Hintergrundbewegung je Panel.
 *
 * Zweck ist nicht Dekoration: Jeder Bereich bekommt eine eigene Bewegung,
 * damit man beim Blick aus zwei Metern sofort erkennt, welches Fenster offen
 * ist — und damit ein leeres Panel nicht wie ein abgestürzter Bildschirm
 * aussieht.
 *
 * Bewusst nur `transform` und `opacity`, beides läuft auf dem Pi in der GPU.
 * Bei „Animationen reduzieren" oder `prefers-reduced-motion` steht alles still;
 * die Muster bleiben als statische Textur sichtbar.
 */
import type { BackdropStyle } from '@shared/types';

export type BackdropVariant = BackdropStyle;

/** Akzentfarbe je Bereich — dieselbe Sprache wie die Statusfarben. */
const TINT: Record<BackdropVariant, string> = {
  none: 'transparent',
  timeline: 'rgb(var(--accent) / 0.5)',
  grid: 'rgba(34, 211, 238, 0.45)',
  drift: 'rgba(56, 189, 248, 0.5)',
  breathe: 'rgba(132, 204, 22, 0.45)',
  pulse: 'rgb(var(--accent) / 0.55)',
  sweep: 'rgba(52, 211, 153, 0.5)',
  orbit: 'rgba(167, 139, 250, 0.5)',
  ring: 'rgb(var(--accent) / 0.5)',
  rain: 'rgba(56, 189, 248, 0.45)',
  embers: 'rgb(var(--accent) / 0.6)',
};

/** Beschriftung fuer die Auswahl in den Einstellungen. */
export const BACKDROP_LABELS: Record<BackdropVariant, string> = {
  none: 'Ohne',
  timeline: 'Zeitlinie',
  grid: 'Raster',
  drift: 'Schlieren',
  breathe: 'Atmen',
  pulse: 'Impulse',
  sweep: 'Abtaststrahl',
  orbit: 'Kreisende Lichter',
  ring: 'Drehender Ring',
  rain: 'Regen',
  embers: 'Funkenflug',
};

export function PanelBackdrop({
  variant,
  className,
}: {
  variant: BackdropVariant;
  className?: string;
}) {
  if (variant === 'none') return null;
  const tint = TINT[variant];

  return (
    <div
      aria-hidden
      className={cx('pointer-events-none absolute inset-0 overflow-hidden opacity-40', className)}
    >
      {render(variant, tint)}
    </div>
  );
}

function render(variant: BackdropVariant, tint: string) {
  switch (variant) {
    // Zeitlinie, die durch den Tag wandert.
    case 'none':
      return null;

    case 'timeline':
      return (
        <>
          {/*
            transform: translateY(%) bezieht sich in CSS auf die Hoehe des
            Elements SELBST, nicht auf die des Panels — ein fest 6rem hohes
            Element haette die Zeitlinie also nur ueber diese 6rem wandern
            lassen und mitten im (viel hoeheren) Panel neu begonnen. Deshalb
            hier: das Element nimmt die volle Panelhoehe ein (inset-0), und
            das sichtbare Band wandert per background-position — das bezieht
            sich korrekt auf die tatsaechliche Elementgroesse.
          */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(180deg, transparent, ${tint}, transparent)`,
              backgroundSize: '100% 22%',
              backgroundRepeat: 'no-repeat',
              opacity: 0.16,
              animation: 'bd-timeline-band 26s linear infinite',
            }}
          />
          {[0.18, 0.38, 0.58, 0.78].map((top) => (
            <span
              key={top}
              className="absolute left-0 h-px w-6"
              style={{ top: `${top * 100}%`, background: tint, opacity: 0.18 }}
            />
          ))}
        </>
      );

    // Driftendes Raster.
    case 'grid':
      return (
        <div
          className="absolute -inset-16"
          style={{
            backgroundImage: `linear-gradient(${tint} 1px, transparent 1px), linear-gradient(90deg, ${tint} 1px, transparent 1px)`,
            backgroundSize: '54px 54px',
            opacity: 0.07,
            animation: 'bd-grid 40s linear infinite',
          }}
        />
      );

    // Schräge Schlieren wie Wind.
    case 'drift':
      return (
        <div
          className="absolute -inset-1/4"
          style={{
            backgroundImage: `repeating-linear-gradient(115deg, ${tint} 0 1px, transparent 1px 46px)`,
            opacity: 0.1,
            animation: 'bd-drift 34s ease-in-out infinite alternate',
          }}
        />
      );

    // Ruhiges Atmen um die nächste Abholung.
    case 'breathe':
      return (
        <div
          className="absolute right-6 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, ${tint}, transparent 68%)`,
            opacity: 0.3,
            animation: 'bd-breathe 11s ease-in-out infinite',
          }}
        />
      );

    // Konzentrische Impulse — wie ein Schaltbefehl, der sich ausbreitet.
    case 'pulse':
      return (
        <>
          {[0, 3.2, 6.4].map((delay) => (
            <div
              key={delay}
              className="absolute left-1/2 top-1/2 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-full border"
              style={{
                borderColor: tint,
                opacity: 0,
                animation: `bd-pulse 9.6s ease-out ${delay}s infinite`,
              }}
            />
          ))}
        </>
      );

    // Abtaststrahl wie auf einem Messgerät.
    case 'sweep':
      return (
        <>
          <div
            className="absolute inset-y-0 w-32"
            style={{
              background: `linear-gradient(90deg, transparent, ${tint}, transparent)`,
              opacity: 0.13,
              animation: 'bd-sweep-x 14s linear infinite',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, ${tint} 0 1px, transparent 1px 28px)`,
              opacity: 0.05,
            }}
          />
        </>
      );

    // Zwei gegenläufige Lichter — das Denken.
    case 'orbit':
      return (
        <>
          <div
            className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{
              background: tint,
              opacity: 0.16,
              animation: 'bd-orbit 28s linear infinite',
            }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{
              background: 'rgb(var(--accent) / 0.5)',
              opacity: 0.13,
              animation: 'bd-orbit 36s linear infinite reverse',
            }}
          />
        </>
      );

    // Drehender Ring.
    case 'ring':
      return (
        <div
          className="absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed"
          style={{
            borderColor: tint,
            opacity: 0.12,
            animation: 'bd-spin 46s linear infinite',
          }}
        />
      );

    // Fallende Tropfen.
    case 'rain':
      return (
        <>
          {[8, 26, 44, 62, 80].map((left, index) => (
            <span
              key={left}
              className="absolute top-0 h-16 w-px"
              style={{
                left: `${left}%`,
                background: `linear-gradient(180deg, transparent, ${tint}, transparent)`,
                opacity: 0.2,
                animation: `bd-timeline ${11 + index * 2.4}s linear ${index * 1.3}s infinite`,
              }}
            />
          ))}
        </>
      );

    // Aufsteigende Funken — die wärmste der Bewegungen.
    case 'embers':
      return (
        <>
          {[12, 30, 48, 66, 84].map((left, index) => (
            <span
              key={left}
              className="absolute bottom-0 h-1.5 w-1.5 rounded-full blur-[1px]"
              style={{
                left: `${left}%`,
                background: tint,
                opacity: 0.35,
                animation: `bd-ember-rise ${14 + index * 3}s linear ${index * 2.2}s infinite`,
              }}
            />
          ))}
        </>
      );

  }
}
