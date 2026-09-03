import { AlarmClock, Plus, Timer as TimerIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useDashboard } from "@/lib/store";
import { cx } from "@/lib/utils";
import { Portal } from "./Portal";

const PRESETS = [3, 5, 10, 15, 20, 30, 45, 60];
const WEEKDAY_LABELS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/**
 * Timer und Wecker per Touch stellen.
 *
 * Der Sprachweg ist der bequemere, aber ein Küchentimer muss auch ohne
 * Mikrofon in zwei Tipps stehen — und ohne Internet funktionieren.
 */
export function TimerQuickAdd({ onClose }: { onClose: () => void }) {
  const { reloadTimers } = useDashboard();
  const [mode, setMode] = useState<"timer" | "alarm">("timer");
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("07:00");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const create = async (minutes?: number) => {
    setBusy(true);
    setError(null);
    try {
      await api.createTimer(
        mode === "timer"
          ? {
              kind: "timer",
              seconds: (minutes ?? 0) * 60,
              label: label.trim() || `${minutes} Minuten`,
            }
          : {
              kind: "alarm",
              time,
              label: label.trim() || "Wecker",
              repeatWeekdays: weekdays,
            },
      );
      await reloadTimers();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) =>
      prev.includes(day)
        ? prev.filter((entry) => entry !== day)
        : [...prev, day].sort(),
    );
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[66] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
        <div className="panel scanlines noise flex w-full max-w-2xl flex-col bg-surface-800">
          <header className="panel-head">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-3.5 w-[2px] shrink-0 rounded-full"
                style={{
                  background: "rgb(var(--accent))",
                  boxShadow: "0 0 10px rgb(var(--accent))",
                }}
              />
              <h2 className="label text-zinc-300">Timer & Wecker</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="touchable flex h-[46px] w-[46px] min-h-0 items-center justify-center rounded-[3px] border border-white/[0.09] text-zinc-400 active:border-accent/50 active:text-accent-soft"
            >
              <X size={20} strokeWidth={1.8} />
            </button>
          </header>

          <div className="p-5">
            {/* Umschalter */}
            <div className="mb-5 flex gap-1.5">
              {[
                { id: "timer" as const, label: "Timer", icon: TimerIcon },
                { id: "alarm" as const, label: "Wecker", icon: AlarmClock },
              ].map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setMode(entry.id)}
                  className={cx(
                    "touchable flex-1 rounded-[3px] border text-2xs uppercase tracking-wide2",
                    mode === entry.id
                      ? "border-accent/50 bg-accent/15 text-accent-soft"
                      : "border-white/[0.08] bg-white/[0.02] text-zinc-400",
                  )}
                >
                  <entry.icon
                    size={15}
                    strokeWidth={1.7}
                    className="mr-2 inline"
                  />
                  {entry.label}
                </button>
              ))}
            </div>

            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={
                mode === "timer"
                  ? "Wofür? z. B. Nudeln (optional)"
                  : "z. B. Aufstehen"
              }
              className="field mb-5"
            />

            {mode === "timer" ? (
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    disabled={busy}
                    onClick={() => void create(minutes)}
                    className="btn min-h-[64px] text-sm"
                  >
                    {minutes} Min
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <input
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    className="field digits w-44 text-lg"
                  />
                  <span className="text-3xs leading-relaxed text-zinc-600">
                    Ohne Wochentage klingelt der Wecker einmalig beim nächsten
                    Erreichen dieser Uhrzeit.
                  </span>
                </div>

                <div className="mb-5 flex gap-1.5">
                  {WEEKDAY_LABELS.map((day, index) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekday(index)}
                      className={cx(
                        "touchable flex-1 rounded-[3px] border text-2xs uppercase tracking-wide2",
                        weekdays.includes(index)
                          ? "border-accent/50 bg-accent/15 text-accent-soft"
                          : "border-white/[0.08] bg-white/[0.02] text-zinc-500",
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void create()}
                  className="btn btn-accent min-h-[64px] w-full text-sm"
                >
                  <Plus size={17} strokeWidth={2} />
                  Wecker stellen
                </button>
              </>
            )}

            {error && <p className="mt-4 text-3xs text-signal-err">{error}</p>}

            <p className="mt-5 text-3xs leading-relaxed text-zinc-600">
              Geht auch per Sprache: „stell einen Timer auf zehn Minuten" oder
              „weck mich werktags um Viertel vor sieben".
            </p>
          </div>
        </div>
      </div>
    </Portal>
  );
}
