import { CloudRain, Compass } from "lucide-react";
import type { WeatherSummary } from "@shared/types";
import { formatWeekday, toDateKey } from "@/lib/format";
import { cx } from "@/lib/utils";
import { WeatherGlyph } from "../WeatherGlyph";

/** Wochenvorschau als Liste mit Temperaturspanne auf gemeinsamer Skala. */
export function WeekList({
  weather,
  variant = "full",
}: {
  weather: WeatherSummary;
  /** `card` lässt Beschreibung und Böen weg — dafür ist die Spalte zu schmal. */
  variant?: "full" | "card";
}) {
  const card = variant === "card";
  const todayKey = toDateKey(new Date());
  const days = weather.forecast;

  const all = days.flatMap((day) => [day.min, day.max]);
  const scaleMin = Math.min(...all);
  const scaleMax = Math.max(...all);
  const span = Math.max(1, scaleMax - scaleMin);

  return (
    <div className="space-y-1">
      {days.map((day) => {
        const isToday = day.date === todayKey;
        const left = ((day.min - scaleMin) / span) * 100;
        const width = ((day.max - day.min) / span) * 100;

        return (
          <div
            key={day.date}
            className={cx(
              "flex items-center gap-3 rounded-[3px] px-2.5",
              card ? "py-3" : "py-2",
              isToday && "bg-accent/[0.07]",
            )}
          >
            <span
              className={cx(
                "shrink-0 text-2xs",
                card ? "w-20" : "w-24",
                isToday ? "text-accent-soft" : "text-zinc-300",
              )}
            >
              {isToday ? "Heute" : formatWeekday(`${day.date}T12:00:00`)}
            </span>

            <WeatherGlyph icon={day.icon} size={20} strokeWidth={1.3} />

            {!card && (
              <span className="hidden w-36 shrink-0 truncate text-3xs text-zinc-500 md:block">
                {day.description}
              </span>
            )}

            <span className="digits w-10 shrink-0 text-right text-2xs text-signal-info">
              {Math.round(day.min)}°
            </span>

            {/* Temperaturspanne */}
            <span className="relative h-1.5 min-w-0 flex-1 rounded-full bg-white/[0.05]">
              <span
                className="absolute inset-y-0 rounded-full"
                style={{
                  left: `${left}%`,
                  width: `${Math.max(3, width)}%`,
                  background: "linear-gradient(90deg, #0284c7, #d97706)",
                }}
              />
            </span>

            <span className="digits w-10 shrink-0 text-2xs text-signal-warn">
              {Math.round(day.max)}°
            </span>

            <span
              className={cx(
                "digits w-14 shrink-0 items-center justify-end gap-1 text-3xs text-zinc-500",
                card ? "flex" : "hidden sm:flex",
              )}
            >
              <CloudRain size={11} strokeWidth={1.6} />
              {day.precipitationChance}%
            </span>

            {!card && (
              <span className="digits hidden w-16 shrink-0 items-center justify-end gap-1 text-3xs text-zinc-600 lg:flex">
                <Compass size={11} strokeWidth={1.6} />
                {day.windGusts ?? 0}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
