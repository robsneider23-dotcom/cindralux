import { AlarmClock, BellOff, Timer as TimerIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import type { AppTimer } from "@shared/types";
import { api } from "@/lib/api";
import { useTimers } from "@/lib/timersStore";
import { playChime } from "@/lib/chime";
import { formatTime } from "@/lib/format";
import { Portal } from "./Portal";

/**
 * Vollbild-Meldung für abgelaufene Timer und Wecker.
 *
 * Ein Küchentimer muss aus der Entfernung erkennbar sein — deshalb Vollbild
 * statt einer kleinen Einblendung. Der Ton wiederholt sich, bis bestätigt wird.
 */
export function TimerOverlay() {
  const { timers, reloadTimers } = useTimers();
  const ringing = timers?.timers.filter((entry) => entry.ringing) ?? [];
  const active = ringing.length > 0;

  // Ton wiederholen, solange etwas klingelt.
  const chimeTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!active) {
      window.clearInterval(chimeTimer.current);
      return;
    }
    playChime();
    chimeTimer.current = window.setInterval(playChime, 3000);
    return () => window.clearInterval(chimeTimer.current);
  }, [active]);

  if (!active) return null;

  const dismiss = async (id: string) => {
    await api.dismissTimer(id);
    await reloadTimers();
  };

  const dismissAll = async () => {
    await api.dismissAllTimers();
    await reloadTimers();
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-black/90 p-6 backdrop-blur-xl">
        {ringing.map((entry) => (
          <RingingCard
            key={entry.id}
            timer={entry}
            onDismiss={() => void dismiss(entry.id)}
          />
        ))}

        {ringing.length > 1 && (
          <button
            type="button"
            onClick={() => void dismissAll()}
            className="btn min-h-[64px] px-8"
          >
            <BellOff size={18} strokeWidth={1.8} />
            Alle bestätigen
          </button>
        )}
      </div>
    </Portal>
  );
}

function RingingCard({
  timer,
  onDismiss,
}: {
  timer: AppTimer;
  onDismiss: () => void;
}) {
  const Icon = timer.kind === "alarm" ? AlarmClock : TimerIcon;

  return (
    <div
      className="panel scanlines noise flex w-full max-w-2xl flex-col items-center gap-5 px-8 py-10"
      style={{
        boxShadow:
          "0 0 0 1px rgb(var(--accent) / 0.5), 0 0 90px -20px rgb(var(--accent) / 0.8)",
      }}
    >
      <Icon
        size={54}
        strokeWidth={1.1}
        className="animate-pulse-soft text-accent"
      />

      <div className="text-center">
        <div className="text-[clamp(1.8rem,4vw,2.8rem)] font-light leading-tight text-zinc-50">
          {timer.label}
        </div>
        <div className="digits mt-2 text-2xs uppercase tracking-wide2 text-zinc-500">
          {timer.kind === "alarm" ? "Wecker" : "Timer"} ·{" "}
          {formatTime(timer.dueAt)}
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="btn btn-accent min-h-[72px] w-full max-w-sm text-sm"
      >
        Bestätigen
      </button>
    </div>
  );
}
