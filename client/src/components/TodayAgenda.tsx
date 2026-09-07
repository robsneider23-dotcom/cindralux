import { CalendarCheck2, CircleDot, Clock3, MapPin } from "lucide-react";
import { useMemo } from "react";
import type { CalendarEvent } from "@shared/types";
import { useCalendarData } from "@/lib/store";
import { useClock } from "@/hooks/useClock";
import {
  formatTime,
  formatDuration,
  relativeTimeLabel,
  toDateKey,
} from "@/lib/format";
import { cx, withAlpha } from "@/lib/utils";
import { Panel, EmptyState, LoadingState } from "./Panel";

/**
 * Tagesübersicht. Zeigt den Fortschritt durch den Tag und hebt den
 * laufenden bzw. nächsten Termin deutlich hervor.
 */
export function TodayAgenda({ className }: { className?: string }) {
  const { data: calendar, loading, error } = useCalendarData();
  const now = useClock(false);

  const { events, current, next, done } = useMemo(() => {
    const todayKey = toDateKey(now);
    const list = (calendar?.events ?? []).filter(
      (event) => toDateKey(new Date(event.start)) === todayKey,
    );

    const timed = list.filter((event) => !event.allDay);
    const running = timed.find(
      (event) => new Date(event.start) <= now && new Date(event.end) >= now,
    );
    const upcoming = timed.find((event) => new Date(event.start) > now);
    const finished = timed.filter((event) => new Date(event.end) < now).length;

    return { events: list, current: running, next: upcoming, done: finished };
  }, [calendar, now]);

  const highlight = current ?? next;

  return (
    <Panel
      title="Heute"
      backdrop="agenda"
      className={className}
      icon={<CalendarCheck2 size={13} strokeWidth={1.6} />}
      meta={
        events.length > 0 ? (
          <span className="digits">
            {done}/{events.filter((e) => !e.allDay).length} erledigt
          </span>
        ) : undefined
      }
      bodyClassName="flex flex-col"
      scroll
    >
      {(loading && calendar === null) ? (
        <LoadingState text="Lade Termine …" />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck2 size={26} strokeWidth={1.2} />}
          text={error ?? "Keine Termine heute"}
        />
      ) : (
        <>
          {/* Hervorgehobener Termin */}
          {highlight && (
            <div
              className="relative mx-3 mt-3 shrink-0 overflow-hidden rounded-lg border p-3.5"
              style={{
                borderColor: withAlpha(highlight.calendarColor, 0.32),
                background: `linear-gradient(115deg, ${withAlpha(highlight.calendarColor, 0.14)}, transparent 70%)`,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    "text-3xs font-medium uppercase tracking-wide2",
                    current ? "text-accent-soft" : "text-zinc-400",
                  )}
                >
                  {current ? "Läuft gerade" : "Als Nächstes"}
                </span>
                {current && (
                  <CircleDot
                    size={11}
                    strokeWidth={2}
                    className="animate-pulse-soft text-accent"
                  />
                )}
                <span className="digits ml-auto text-3xs text-zinc-400">
                  {relativeTimeLabel(
                    new Date(highlight.start),
                    new Date(highlight.end),
                    now,
                  )}
                </span>
              </div>

              <div className="mt-2 truncate text-[clamp(1rem,1.5vw,1.2rem)] font-medium leading-tight text-zinc-50">
                {highlight.title}
              </div>

              <div className="mt-2 flex items-center gap-3 text-2xs text-zinc-400">
                <span className="digits flex items-center gap-1.5">
                  <Clock3 size={12} strokeWidth={1.6} />
                  {formatTime(highlight.start)}–{formatTime(highlight.end)}
                </span>
                {highlight.location && (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <MapPin size={12} strokeWidth={1.6} />
                    <span className="truncate">{highlight.location}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Restlicher Tagesverlauf */}
          <ul className="mt-2 shrink-0 px-3 pb-3">
            {events.map((event) => (
              <AgendaRow
                key={event.id}
                event={event}
                now={now}
                highlighted={event.id === highlight?.id}
              />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function AgendaRow({
  event,
  now,
  highlighted,
}: {
  event: CalendarEvent;
  now: Date;
  highlighted: boolean;
}) {
  const past = !event.allDay && new Date(event.end) < now;

  return (
    <li
      className={cx(
        "flex items-center gap-3 rounded-lg py-2 pl-1 pr-2 transition-opacity duration-200",
        past && "opacity-60",
        highlighted && "bg-white/[0.03]",
      )}
    >
      <span
        className="event-bar self-stretch"
        style={{ background: event.calendarColor, opacity: past ? 0.5 : 1 }}
      />

      <span className="digits w-[3.2rem] shrink-0 text-2xs text-zinc-400">
        {event.allDay ? (
          <span className="text-zinc-600">ganzt.</span>
        ) : (
          formatTime(event.start)
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cx(
            "block truncate text-sm leading-tight",
            past
              ? "text-zinc-500 line-through decoration-zinc-700"
              : "text-zinc-200",
          )}
        >
          {event.title}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-3xs text-zinc-600">
          <span className="truncate">{event.calendarName}</span>
          {!event.allDay && (
            <>
              <span className="text-zinc-800">·</span>
              <span className="digits shrink-0">
                {formatDuration(new Date(event.start), new Date(event.end))}
              </span>
            </>
          )}
        </span>
      </span>
    </li>
  );
}
