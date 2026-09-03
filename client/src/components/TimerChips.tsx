import { AlarmClock, Timer as TimerIcon, X } from "lucide-react";
import type { AppTimer } from "@shared/types";
import { api } from "@/lib/api";
import { useDashboard } from "@/lib/store";
import { useClock } from "@/hooks/useClock";
import { formatTime } from "@/lib/format";
import { cx } from "@/lib/utils";

/** Verbleibende Zeit als mm:ss bzw. h:mm:ss. */
function remaining(dueAt: string, now: Date): string {
  const seconds = Math.max(
    0,
    Math.round((new Date(dueAt).getTime() - now.getTime()) / 1000),
  );
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/**
 * Laufende Timer und der nächste Wecker in der Statusleiste.
 *
 * Sie erscheinen nur, wenn etwas läuft — im Ruhezustand kostet die Anzeige
 * keinen Platz. Timer zählen sekündlich herunter, Wecker zeigen ihre Uhrzeit.
 */
export function TimerChips() {
  const { timers, reloadTimers } = useDashboard();
  const now = useClock(true);

  const entries = (timers?.timers ?? []).filter(
    (entry) => entry.enabled && !entry.ringing,
  );
  if (entries.length === 0) return null;

  // Höchstens drei zeigen, damit die Kopfleiste nicht überläuft.
  const visible = entries.slice(0, 2);

  const remove = async (id: string) => {
    await api.deleteTimer(id);
    await reloadTimers();
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {visible.map((entry) => (
        <Chip
          key={entry.id}
          timer={entry}
          now={now}
          onRemove={() => void remove(entry.id)}
        />
      ))}
      {entries.length > visible.length && (
        <span className="digits text-3xs text-zinc-600">
          +{entries.length - visible.length}
        </span>
      )}
    </div>
  );
}

function Chip({
  timer,
  now,
  onRemove,
}: {
  timer: AppTimer;
  now: Date;
  onRemove: () => void;
}) {
  const isAlarm = timer.kind === "alarm";
  const secondsLeft = (new Date(timer.dueAt).getTime() - now.getTime()) / 1000;
  // In der letzten Minute deutlich hervorheben.
  const urgent = !isAlarm && secondsLeft <= 60;

  return (
    <span
      className={cx(
        "flex items-center gap-2 rounded-[3px] border px-2.5 py-2",
        urgent
          ? "border-accent/50 bg-accent/[0.14]"
          : "border-white/[0.09] bg-white/[0.025]",
      )}
      title={timer.label}
    >
      {isAlarm ? (
        <AlarmClock
          size={13}
          strokeWidth={1.7}
          className="shrink-0 text-zinc-500"
        />
      ) : (
        <TimerIcon
          size={13}
          strokeWidth={1.7}
          className={cx(
            "shrink-0",
            urgent ? "text-accent animate-pulse-soft" : "text-zinc-500",
          )}
        />
      )}

      <span className="min-w-0">
        <span
          className={cx(
            "digits block text-2xs leading-none",
            urgent ? "text-accent-soft" : "text-zinc-200",
          )}
        >
          {isAlarm ? formatTime(timer.dueAt) : remaining(timer.dueAt, now)}
        </span>
        <span className="mt-1 block max-w-[6rem] truncate text-3xs leading-none text-zinc-600">
          {timer.label}
        </span>
      </span>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`${timer.label} entfernen`}
        className="shrink-0 text-zinc-700 transition-colors active:text-signal-err"
      >
        <X size={13} strokeWidth={2} />
      </button>
    </span>
  );
}
