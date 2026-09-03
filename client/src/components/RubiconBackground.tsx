import { useDashboard } from "@/lib/store";

/**
 * Hintergrundebene des Dashboards.
 *
 * Aufbau von unten nach oben: Grundton, Radial-Lichter, technisches Raster,
 * das gewaehlte Rubicon-Backdrop, das Wasserzeichen und ein langsamer
 * Scan-Streifen. Alles ohne Interaktion und hinter dem gesamten Inhalt.
 */
export function RubiconBackground() {
  const { config } = useDashboard();
  const background = config?.appearance.background ?? "";

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
            "radial-gradient(90% 60% at 12% -10%, rgb(var(--accent) / 0.16), transparent 60%)," +
            "radial-gradient(70% 50% at 100% 108%, rgba(34, 211, 238, 0.07), transparent 62%)",
        }}
      />

      <div className="absolute inset-0 grid-bg" />

      {background && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(/rubicon/${background})`,
            opacity: "var(--backdrop-opacity)",
            maskImage:
              "radial-gradient(120% 100% at 70% 40%, #000 20%, transparent 78%)",
            WebkitMaskImage:
              "radial-gradient(120% 100% at 70% 40%, #000 20%, transparent 78%)",
          }}
        />
      )}

      {/* Wasserzeichen — bewusst angeschnitten, damit es Flaeche statt Logo wirkt */}
      <img
        src="/rubicon/watermark.svg"
        alt=""
        className="absolute -bottom-[14vh] -right-[8vw] w-[52vh] min-w-[320px] opacity-[0.07] animate-spin-slow"
      />

      {/* Sehr langsamer Lichtstreifen — gibt der Flaeche Leben, ohne zu stoeren */}
      <div className="absolute inset-x-0 top-0 h-1/3 animate-sweep bg-gradient-to-b from-transparent via-white/[0.018] to-transparent" />

      {/* Vignette schliesst die Raender ab */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 45%, transparent 45%, rgba(0,0,0,0.72) 100%)",
        }}
      />
    </div>
  );
}
