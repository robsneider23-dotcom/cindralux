import { Clock3, MapPin } from "lucide-react";
import { useMemo } from "react";
import type { CalendarEvent } from "@shared/types";
import { formatDuration, formatTime, toDateKey } from "@/lib/format";
import { cx, withAlpha } from "@/lib/utils";

/** Erste und letzte Stunde, die die Tagesansicht zeigt. */
const START_HOUR = 6;
const END_HOUR = 23;

/**
 * Höhe einer Stunde in Pixeln.
 *
 * Feste Pixel statt Prozent: Bei prozentualer Höhe schrumpft eine Viertelstunde
 * auf wenige Pixel und der Titel wird abgeschnitten. Mit fester Skala scrollt
 * der Tag stattdessen — so bleibt jeder Termin lesbar.
 */
const HOUR_HEIGHT = 58;
/** Mindesthöhe, damit auch ein 15-Minuten-Termin seinen Titel zeigt. */
const MIN_EVENT_HEIGHT = 38;
/** Breite der Stundenspalte. */
const GUTTER = 56;

/**
 * Tagesansicht als Zeitschiene.
 *
 * Termine liegen maßstäblich auf einer Stundenachse — so sieht man Lücken und
 * Überschneidungen sofort, was eine reine Liste nicht leistet. Ganztägige
 * Termine stehen als Band darüber.
 */
export function DayView({
  events,
  day,
  now,
}: {
  events: CalendarEvent[];
  day: Date;
  now: Date;
}) {
  const { allDay, timed } = useMemo(() => {
    const key = toDateKey(day);
    const relevant = events.filter((event) => {
      if (event.allDay) {
        // Ueber Datumsschluessel vergleichen: Zeitzonen verschieben Mitternacht.
        return toDateKey(new Date(event.start)) <= key && key < toDateKey(new Date(event.end));
      }
      return toDateKey(new Date(event.start)) === key;
    });

    return {
      allDay: relevant.filter((event) => event.allDay),
      timed: relevant
        .filter((event) => !event.allDay)
        .sort(
          (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
        ),
    };
  }, [events, day]);

  const hours = END_HOUR - START_HOUR;
  const gridHeight = hours * HOUR_HEIGHT;
  const isToday = toDateKey(now) === toDateKey(day);
  const nowTop =
    (now.getHours() + now.getMinutes() / 60 - START_HOUR) * HOUR_HEIGHT;

  /** Position eines Termins in Pixeln auf der Zeitschiene. */
  const place = (event: CalendarEvent) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const top = (Math.max(START_HOUR, startHour) - START_HOUR) * HOUR_HEIGHT;
    const bottom = (Math.min(END_HOUR, endHour) - START_HOUR) * HOUR_HEIGHT;
    return { top, height: Math.max(MIN_EVENT_HEIGHT, bottom - top) };
  };

  return (
    <div className="flex h-full flex-col px-3 pb-3">
      {allDay.length > 0 && (
        <div className="shrink-0 space-y-1 py-2">
          {allDay.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-2.5 rounded-[3px] border px-3 py-2"
              style={{
                borderColor: withAlpha(event.calendarColor, 0.28),
                background: withAlpha(event.calendarColor, 0.09),
              }}
            >
              <span
                className="text-3xs font-medium uppercase tracking-wide2"
                style={{ color: event.calendarColor }}
              >
                Ganztägig
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">
                {event.title}
              </span>
              <span className="shrink-0 text-3xs text-zinc-500">
                {event.calendarName}
              </span>
            </div>
          ))}
        </div>
      )}

      {timed.length === 0 && allDay.length === 0 ? (
        <p className="my-auto text-center text-2xs uppercase tracking-wide2 text-zinc-600">
          Keine Termine an diesem Tag
        </p>
      ) : (
        <div
          className="relative min-h-0 flex-1 overflow-y-auto no-scrollbar"
          // Explizit, nicht nur vom Wrapper geerbt: Ein eigener Scroll-
          // Container entscheidet ueber Touch-Gesten offenbar anhand seines
          // eigenen touch-action-Werts, nicht (nur) des vom Elternelement
          // geerbten — ohne das brach die Wisch-Erkennung fuer Tag-Wechsel
          // (CalendarTimeline.tsx) hier zuverlaessig per pointercancel ab,
          // waehrend dieselbe Geste im Monatsraster (kein Scroll-Container)
          // anstandslos funktionierte.
          style={{ touchAction: "pan-y" }}
        >
          <div className="relative" style={{ height: gridHeight }}>
            {Array.from({ length: hours + 1 }, (_, index) => {
              const hour = START_HOUR + index;
              return (
                <div
                  key={hour}
                  className="absolute inset-x-0 flex items-center gap-2"
                  style={{ top: index * HOUR_HEIGHT }}
                >
                  <span
                    className="digits shrink-0 text-right text-3xs text-zinc-600"
                    style={{ width: GUTTER - 10 }}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </span>
                  <span className="h-px flex-1 bg-white/[0.05]" />
                </div>
              );
            })}

            {isToday && nowTop >= 0 && nowTop <= gridHeight && (
              <div
                className="absolute z-10 flex items-center"
                style={{ top: nowTop, left: GUTTER - 4, right: 0 }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-accent shadow-glow" />
                <span className="h-px flex-1 bg-accent/50" />
              </div>
            )}

            {timed.map((event) => {
              const { top, height } = place(event);
              const past = isToday && new Date(event.end) < now;
              return (
                <div
                  key={event.id}
                  className={cx(
                    "absolute right-1 z-[5] overflow-hidden rounded-[3px] border px-2.5 py-1.5",
                    past && "opacity-45",
                  )}
                  style={{
                    top,
                    height,
                    left: GUTTER + 4,
                    borderColor: withAlpha(event.calendarColor, 0.35),
                    background: `linear-gradient(100deg, ${withAlpha(event.calendarColor, 0.2)}, ${withAlpha(event.calendarColor, 0.07)})`,
                    // Farbige Kante: die Kalenderzugehörigkeit muss auf einen
                    // Blick erkennbar sein, ein zarter Rand reicht dafür nicht.
                    boxShadow: `inset 3px 0 0 0 ${event.calendarColor}`,
                  }}
                >
                  <div className="truncate text-2xs font-medium leading-tight text-zinc-50">
                    {event.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2.5 text-3xs text-zinc-400">
                    <span className="digits flex items-center gap-1">
                      <Clock3 size={9} strokeWidth={1.8} />
                      {formatTime(event.start)}–{formatTime(event.end)}
                    </span>
                    <span className="digits shrink-0">
                      {formatDuration(
                        new Date(event.start),
                        new Date(event.end),
                      )}
                    </span>
                    {event.location && (
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin
                          size={9}
                          strokeWidth={1.8}
                          className="shrink-0"
                        />
                        <span className="truncate">{event.location}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
