import { useMemo } from "react";
import type { CalendarEvent } from "@shared/types";
import { addDays, formatTime, startOfDay, toDateKey } from "@/lib/format";
import { cx, withAlpha } from "@/lib/utils";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/**
 * Monatsraster mit den Terminen je Tag.
 *
 * Wo Platz ist, stehen die Titel — ein Punkt allein sagt nur, DASS etwas ist,
 * nicht WAS. Auf flachen Panels (1024x600) bleibt es bei Punkten, dort waeren
 * Titel ohnehin nicht lesbar. Ein Tipp auf einen Tag oeffnet die Tagesansicht.
 */
export function MonthGrid({
  events,
  now,
  onPickDay,
}: {
  events: CalendarEvent[];
  now: Date;
  onPickDay: (date: Date) => void;
}) {
  const { weeks, monthIndex } = useMemo(() => {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    // Woche beginnt montags: Sonntag (0) auf 6 abbilden.
    const leading = (first.getDay() + 6) % 7;
    const gridStart = addDays(first, -leading);

    const rows: Date[][] = [];
    for (let week = 0; week < 6; week += 1) {
      rows.push(
        Array.from({ length: 7 }, (_, day) =>
          addDays(gridStart, week * 7 + day),
        ),
      );
    }
    return { weeks: rows, monthIndex: now.getMonth() };
  }, [now]);

  // Termine nach Tag bündeln — einmal, statt je Zelle zu filtern.
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const start = startOfDay(new Date(event.start));
      if (event.allDay) {
        const end = new Date(event.end);
        let cursor = start;
        while (cursor < end) {
          const key = toDateKey(cursor);
          map.set(key, [...(map.get(key) ?? []), event]);
          cursor = addDays(cursor, 1);
        }
        continue;
      }
      const key = toDateKey(start);
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [events]);

  const todayKey = toDateKey(now);

  return (
    <div className="flex h-full flex-col px-3 pb-3">
      <div className="grid shrink-0 grid-cols-7 gap-1 pb-1.5 pt-1">
        {WEEKDAYS.map((day) => (
          <span key={day} className="label-dim text-center">
            {day}
          </span>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-6 gap-1">
        {weeks.map((week, index) => (
          <div key={index} className="grid grid-cols-7 gap-1">
            {week.map((day) => {
              const key = toDateKey(day);
              const dayEvents = byDay.get(key) ?? [];
              const isToday = key === todayKey;
              const outside = day.getMonth() !== monthIndex;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onPickDay(day)}
                  className={cx(
                    "touchable flex min-h-0 flex-col items-stretch overflow-hidden rounded-[3px] border px-1.5 py-1 text-left",
                    isToday
                      ? "border-accent/50 bg-accent/[0.1]"
                      : "border-white/[0.05] bg-white/[0.012]",
                    outside && "opacity-35",
                  )}
                >
                  <span
                    className={cx(
                      "digits shrink-0 text-2xs leading-none",
                      isToday
                        ? "font-medium text-accent-soft"
                        : "text-zinc-400",
                    )}
                  >
                    {day.getDate()}
                  </span>

                  {/* Titel, sobald die Zelle hoch genug ist */}
                  <span className="mt-1 flex min-h-0 flex-1 flex-col gap-[2px] overflow-hidden short:hidden">
                    {dayEvents.slice(0, 3).map((event, index) => (
                      <span
                        key={`${event.id}-${index}`}
                        className="flex items-center gap-1 overflow-hidden rounded-[2px] px-1 py-[1px]"
                        style={{
                          background: withAlpha(event.calendarColor, 0.16),
                        }}
                        title={event.title}
                      >
                        {!event.allDay && (
                          <span className="digits shrink-0 text-3xs leading-none text-zinc-400">
                            {formatTime(event.start)}
                          </span>
                        )}
                        <span
                          className="truncate text-3xs leading-tight"
                          style={{ color: event.calendarColor }}
                        >
                          {event.title}
                        </span>
                      </span>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="digits px-1 text-3xs leading-none text-zinc-500">
                        +{dayEvents.length - 3} weitere
                      </span>
                    )}
                  </span>

                  {/* Flache Panels: nur Punkte */}
                  <span className="mt-auto hidden flex-wrap items-center gap-[3px] pt-1 short:flex">
                    {dayEvents.slice(0, 4).map((event, dot) => (
                      <span
                        key={`${event.id}-dot-${dot}`}
                        className="h-[5px] w-[5px] shrink-0 rounded-full"
                        style={{
                          background: event.calendarColor,
                          boxShadow: `0 0 5px ${withAlpha(event.calendarColor, 0.8)}`,
                        }}
                      />
                    ))}
                    {dayEvents.length > 4 && (
                      <span className="digits text-3xs leading-none text-zinc-600">
                        +{dayEvents.length - 4}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
