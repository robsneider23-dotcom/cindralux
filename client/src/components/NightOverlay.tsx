import { Moon } from "lucide-react";
import type { NightMode } from "@/hooks/useNightMode";
import { useClock } from "@/hooks/useClock";
import { formatDateLong, formatWeekday } from "@/lib/format";
import { useDashboard } from "@/lib/store";
import { cx } from "@/lib/utils";

/**
 * Abdunklung während der Nachtabsenkung.
 *
 * Zwei Stufen: eine schwarze Ebene über dem Dashboard, und optional eine reine
 * Uhranzeige. Beide reagieren auf jede Berührung — das Wecken übernimmt
 * useNightMode, hier wird nur dargestellt.
 */
export function NightOverlay({ night }: { night: NightMode }) {
  const { trash } = useDashboard();
  const now = useClock(false);

  if (!night.dimmed && !night.awake) return null;

  const urgentTrash =
    trash?.next?.isToday || trash?.next?.isTomorrow ? trash.next : null;

  return (
    <>
      {/* Abdunklung. pointer-events-none, damit man weiterhin bedienen kann. */}
      <div
        className="pointer-events-none fixed inset-0 z-40 bg-black transition-opacity duration-1000 ease-calm"
        style={{ opacity: night.overlayOpacity }}
      />

      {/* Reine Uhranzeige */}
      {night.clockOnly && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-surface-900 transition-opacity duration-700">
          <div
            className="flex flex-col items-center"
            style={{ opacity: Math.max(0.12, 1 - night.overlayOpacity) }}
          >
            <span className="digits text-[clamp(5rem,17vw,13rem)] font-extralight leading-none tracking-tight text-zinc-200">
              {String(now.getHours()).padStart(2, "0")}
              <span className="mx-2 text-accent/70">:</span>
              {String(now.getMinutes()).padStart(2, "0")}
            </span>
            <span className="mt-5 text-[clamp(0.9rem,1.6vw,1.3rem)] text-zinc-500">
              {formatWeekday(now)}, {formatDateLong(now)}
            </span>

            {/* Auch nachts sichtbar: was morgen früh rausmuss. */}
            {urgentTrash && (
              <span
                className={cx(
                  "mt-8 flex items-center gap-2.5 rounded-[3px] border px-4 py-2.5",
                  "text-2xs uppercase tracking-wide2",
                )}
                style={{
                  borderColor: `${urgentTrash.color}55`,
                  color: urgentTrash.color,
                  background: `${urgentTrash.color}14`,
                }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: urgentTrash.color }}
                />
                {urgentTrash.label} {urgentTrash.isToday ? "heute" : "morgen"}
              </span>
            )}

            <span className="mt-10 flex items-center gap-2 text-3xs uppercase tracking-label text-zinc-700">
              <Moon size={11} strokeWidth={1.8} />
              Nachtmodus — Bildschirm berühren
            </span>
          </div>
        </div>
      )}
    </>
  );
}
