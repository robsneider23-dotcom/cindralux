import { Bus, TrainFront, TramFront, Ship, AlertTriangle, Footprints } from "lucide-react";
import type { TransitDeparture, TransitMode } from "@shared/types";
import { useTransitData } from "@/lib/store";
import { formatTime } from "@/lib/format";
import { cx } from "@/lib/utils";
import { Panel, EmptyState, LoadingState } from "./Panel";

/**
 * Abfahrtstafel und Fahrzeit zur Arbeit.
 *
 * Gelesen wird aus zwei Metern Entfernung im Vorbeigehen, meist mit Jacke in
 * der Hand. Deshalb steht die wichtigste Zahl — Minuten bis zur Abfahrt —
 * gross und rechts, wo das Auge nach der Linie landet, und nicht die Uhrzeit:
 * "in 4 min" beantwortet die Frage, "08:51" muss man erst verrechnen.
 */

function ModeIcon({ mode, size = 15 }: { mode: TransitMode; size?: number }) {
  const props = { size, strokeWidth: 1.6 };
  if (mode === "bus") return <Bus {...props} />;
  if (mode === "tram") return <TramFront {...props} />;
  if (mode === "ferry") return <Ship {...props} />;
  return <TrainFront {...props} />;
}

/** Minuten bis zur Abfahrt, so wie man es sagen würde. */
function relativeLabel(minutes: number): string {
  if (minutes <= 0) return "jetzt";
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest}` : `${hours} h`;
  }
  return String(minutes);
}

function DepartureRow({ departure }: { departure: TransitDeparture }) {
  const { cancelled, reachable, delayMinutes, realtime } = departure;

  return (
    <li
      className={cx(
        "flex items-center gap-3 border-b border-white/[0.04] py-2 last:border-0",
        // Nicht mehr erreichbar: sichtbar, aber zurückgenommen. Ganz ausblenden
        // wäre falsch — dann wirkt die Tafel, als führe gerade nichts.
        (!reachable || cancelled) && "opacity-40",
      )}
    >
      <span className="shrink-0 text-zinc-500">
        <ModeIcon mode={departure.mode} />
      </span>

      <span
        className={cx(
          "digits w-14 shrink-0 truncate text-sm font-medium",
          cancelled ? "text-zinc-500 line-through" : "text-zinc-100",
        )}
      >
        {departure.line}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">
        {departure.headsign}
      </span>

      {departure.platform && (
        <span className="digits shrink-0 text-3xs uppercase tracking-label text-zinc-600">
          Gl. {departure.platform}
        </span>
      )}

      <span className="flex shrink-0 flex-col items-end leading-tight">
        {cancelled ? (
          <span className="text-2xs uppercase tracking-wide2 text-red-400">
            Fällt aus
          </span>
        ) : (
          <>
            <span className="digits text-base font-light text-zinc-50">
              {relativeLabel(departure.inMinutes)}
              {departure.inMinutes > 0 && departure.inMinutes < 60 && (
                <span className="ml-1 text-3xs text-zinc-500">min</span>
              )}
            </span>
            <span className="digits text-3xs text-zinc-600">
              {formatTime(departure.time)}
              {/*
                Verspätung nur zeigen, wenn es eine gibt — eine Reihe aus
                "+0" untereinander ist Rauschen. Ohne Echtzeitmeldung steht
                dort bewusst nichts statt einer erfundenen Pünktlichkeit.
              */}
              {realtime && delayMinutes > 0 && (
                <span className="ml-1 text-amber-400">+{delayMinutes}</span>
              )}
            </span>
          </>
        )}
      </span>
    </li>
  );
}

export function TransitPanel({ className }: { className?: string }) {
  const { data, loading, error } = useTransitData();
  const icon = <Bus size={13} strokeWidth={1.6} />;
  const title = data?.stopName || "Abfahrten";

  if (loading && data === null) {
    return (
      <Panel title="Abfahrten" className={className} icon={icon}>
        <div className="py-8">
          <LoadingState text="Lade Abfahrten …" />
        </div>
      </Panel>
    );
  }

  if (!data?.configured) {
    return (
      <Panel title="Abfahrten" className={className} icon={icon}>
        <EmptyState
          icon={<Bus size={26} strokeWidth={1.2} />}
          text="Haltestelle in den Einstellungen wählen"
        />
      </Panel>
    );
  }

  const journey = data.journeys.find((entry) => entry.reachable) ?? data.journeys[0];

  return (
    <Panel title={title} className={className} icon={icon} backdrop="transit">
      {/*
        Veraltete Daten offen anschreiben, statt sie stillschweigend zu zeigen.
        Eine Abfahrtstafel, die unbemerkt stehenbleibt, ist schlimmer als gar
        keine — danach richtet man sich und steht am Bahnsteig.
      */}
      {data.stale && (
        <div className="mb-2 flex items-center gap-2 rounded-[3px] border border-amber-500/25 bg-amber-500/[0.07] px-2.5 py-1.5">
          <AlertTriangle size={12} strokeWidth={1.8} className="shrink-0 text-amber-400" />
          <span className="text-3xs uppercase tracking-label text-amber-300/90">
            Keine Verbindung — Stand von vorhin
          </span>
        </div>
      )}

      {data.departures.length === 0 ? (
        <EmptyState
          icon={<Bus size={26} strokeWidth={1.2} />}
          text={error ? "Abfahrten nicht abrufbar" : "Keine Abfahrten in nächster Zeit"}
        />
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {data.departures.map((departure) => (
            <DepartureRow key={departure.id} departure={departure} />
          ))}
        </ul>
      )}

      {/* Fahrzeit zur Arbeit — nur wenn ein Ziel eingestellt ist. */}
      {journey && data.destinationName && (
        <div className="mt-2 border-t border-white/[0.06] pt-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-3xs uppercase tracking-label text-zinc-500">
              nach {data.destinationName}
            </span>
            <span className="digits shrink-0 text-sm text-zinc-100">
              {journey.durationMinutes} min
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-3xs text-zinc-600">
            <span className="digits truncate">
              {formatTime(journey.departure)} – {formatTime(journey.arrival)}
              {journey.lines.length > 0 && ` · ${journey.lines.join(" · ")}`}
            </span>
            <span className="shrink-0">
              {journey.transfers === 0
                ? "ohne Umstieg"
                : `${journey.transfers}× umsteigen`}
            </span>
          </div>
        </div>
      )}
    </Panel>
  );
}

/** Der Fussweg-Hinweis, den die Einstellungen neben dem Regler zeigen. */
export function WalkHint({ minutes }: { minutes: number }) {
  return (
    <span className="flex items-center gap-1.5 text-3xs text-zinc-600">
      <Footprints size={11} strokeWidth={1.7} />
      Abfahrten in weniger als {minutes} Minuten gelten als nicht mehr erreichbar.
    </span>
  );
}
