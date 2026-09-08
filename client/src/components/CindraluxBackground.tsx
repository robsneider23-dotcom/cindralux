import type { CSSProperties, ReactNode } from "react";
import { useDashboardConfig } from "@/lib/store";

/**
 * Hintergrundebene des Dashboards.
 *
 * Aufbau von unten nach oben: Grundton, Radial-Lichter, technisches Raster,
 * das gewaehlte Cindralux-Backdrop, das Wasserzeichen und ein langsamer
 * Scan-Streifen. Alles ohne Interaktion und hinter dem gesamten Inhalt.
 */
/** Botanisches Zweig-Motiv fuer den Skin "herbarium" — ein Stiel mit zwei
 * Blaettern und einer Bluete aus fuenf Bluetenblaettern, identisch zum
 * Design-Mockup. */
function HerbariumSprig({ style }: { style: CSSProperties }) {
  return (
    <svg
      className="sprig absolute"
      style={{ stroke: "rgb(var(--ink-600))", fill: "none", strokeWidth: 1.3, opacity: 0.45, ...style }}
      viewBox="0 0 60 110"
    >
      <path d="M30 108 C27 80 33 55 30 26" />
      <path d="M30 66 C18 60 9 48 6 32" />
      <path d="M30 70 C42 64 51 52 54 36" style={{ fill: "rgb(var(--ink-700))", stroke: "none", opacity: 0.5 }} />
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse
          key={deg}
          cx="30"
          cy="14"
          rx="6"
          ry="11"
          style={{ fill: "rgb(var(--accent))", stroke: "none", opacity: 0.4 }}
          transform={`rotate(${deg} 30 14)`}
        />
      ))}
    </svg>
  );
}

/** Kirschblueten-Zweig fuer den Skin "ikebana" — bewusst asymmetrisch. */
function IkebanaBranch() {
  return (
    <svg
      className="absolute right-[90px] top-[26px] h-[340px] w-[170px] opacity-70"
      viewBox="0 0 170 340"
    >
      <path d="M150 10 C120 60 100 110 105 160 C110 220 90 270 60 330" stroke="rgb(var(--ink-700))" strokeWidth="1.4" fill="none" />
      <path d="M110 90 C90 96 72 92 58 78" stroke="rgb(var(--ink-700))" strokeWidth="1.1" fill="none" />
      <path d="M100 150 C78 152 62 144 50 128" stroke="rgb(var(--ink-700))" strokeWidth="1.1" fill="none" />
      <path d="M90 220 C68 224 52 216 40 200" stroke="rgb(var(--ink-700))" strokeWidth="1.1" fill="none" />
      <g fill="rgb(var(--accent))" opacity="0.55">
        <circle cx="58" cy="78" r="6" /><circle cx="42" cy="70" r="5" /><circle cx="66" cy="62" r="4.5" />
        <circle cx="50" cy="128" r="6" /><circle cx="34" cy="122" r="5" />
        <circle cx="40" cy="200" r="6" /><circle cx="24" cy="196" r="4.5" />
        <circle cx="105" cy="160" r="5" />
      </g>
    </svg>
  );
}

/** Blattform fuer den Skin "greenhouse" — oben rechts, wie im Mockup. */
function GreenhouseLeaf() {
  return (
    <svg className="absolute -right-20 -top-16 h-[420px] w-[420px] opacity-90" viewBox="0 0 200 200">
      <path d="M100 10 C160 30 185 90 165 150 C145 195 90 195 60 165 C10 115 30 40 100 10Z" fill="rgb(var(--accent))" opacity="0.16" />
      <path d="M110 30 C155 48 172 95 156 140 C140 175 100 178 78 155 C42 118 58 60 110 30Z" fill="rgb(var(--accent))" opacity="0.28" />
      <path d="M118 55 C25 70 40 155 118 175" stroke="rgb(var(--surface-900))" strokeWidth="3" fill="none" opacity="0.5" />
    </svg>
  );
}

const SKIN_MOTIFS: Partial<Record<string, () => ReactNode>> = {
  herbarium: () => (
    <>
      <HerbariumSprig style={{ top: 8, right: 230, width: 70, height: 110, transform: "rotate(8deg)" }} />
      <HerbariumSprig style={{ bottom: 14, left: 20, width: 56, height: 90, transform: "rotate(-14deg)" }} />
    </>
  ),
  ikebana: () => <IkebanaBranch />,
  greenhouse: () => <GreenhouseLeaf />,
};

export function CindraluxBackground() {
  const config = useDashboardConfig();
  const background = config?.appearance.background ?? "";
  const skin = config?.appearance.skin ?? "default";

  // Design-Richtung aktiv: eigene, ruhigere Hintergrundschicht statt der
  // sonst ueblichen Cindralux-Grafik — Muster/Verlaeufe kommen aus
  // theme/skins.css, ergaenzt um ein paar Skins mit einem gezeichneten Motiv.
  if (skin !== "default") {
    const Motif = SKIN_MOTIFS[skin];
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-surface-900"
      >
        <div className="skin-atmosphere absolute inset-0" />
        {Motif && <Motif />}
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-surface-900"
    >
      {/* Warmes Licht oben links, kuehler Gegenpol unten rechts */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 60% at 12% -10%, rgb(var(--accent) / 0.09), transparent 60%)," +
            "radial-gradient(70% 50% at 100% 108%, rgba(34, 211, 238, 0.035), transparent 62%)",
        }}
      />

      <div className="absolute inset-0 grid-bg" />

      {background && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(/cindralux/${background})`,
            opacity: "calc(var(--backdrop-opacity) * 0.35)",
            maskImage:
              "radial-gradient(120% 100% at 70% 40%, #000 20%, transparent 78%)",
            WebkitMaskImage:
              "radial-gradient(120% 100% at 70% 40%, #000 20%, transparent 78%)",
          }}
        />
      )}

      {/* Wasserzeichen — bewusst angeschnitten, damit es Flaeche statt Logo wirkt */}
      <img
        src="/cindralux/watermark.svg"
        alt=""
        className="absolute -bottom-[14vh] -right-[8vw] w-[52vh] min-w-[320px] opacity-[0.025]"
      />

      {/* Sehr langsamer Lichtstreifen — gibt der Flaeche Leben, ohne zu stoeren */}
      <div className="absolute inset-x-0 top-0 h-1/3 animate-sweep bg-gradient-to-b from-transparent via-white/[0.018] to-transparent" />

      {/* Vignette schliesst die Raender ab */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 45%, transparent 45%, rgb(var(--shade) / 0.3) 100%)",
        }}
      />
    </div>
  );
}
