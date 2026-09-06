import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  RefreshCw,
  TriangleAlert,
  History,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CalendarEvent, CalendarView } from "@shared/types";
import { api } from "@/lib/api";
import { useDashboard } from "@/lib/store";
import { useClock } from "@/hooks/useClock";
import { useSwipe } from "@/hooks/useSwipe";
import {
  addDays,
  formatDateShort,
  formatTime,
  relativeDayLabel,
  startOfDay,
  toDateKey,
} from "@/lib/format";
import { cx, withAlpha } from "@/lib/utils";
import { Panel, EmptyState, LoadingState } from "./Panel";
import { MonthGrid } from "./calendar/MonthGrid";
import { DayView } from "./calendar/DayView";
import { DaySheet } from "./calendar/DaySheet";

const DAYS_AHEAD = 7;

interface DayBucket {
  key: string;
  date: Date;
  allDay: CalendarEvent[];
  timed: CalendarEvent[];
}

/**
 * Zusammengeführte Ansicht aller Kalenderquellen über die nächsten sieben Tage.
 * Ganztägige Termine stehen als eigene Zeile über den zeitgebundenen, damit
 * beide Arten sauber lesbar bleiben.
 */
const VIEW_LABELS: Array<{ id: CalendarView; label: string }> = [
  { id: "tag", label: "Tag" },
  { id: "woche", label: "Woche" },
  { id: "monat", label: "Monat" },
];

export function CalendarTimeline({ className }: { className?: string }) {
  const { calendar, config, pending, reloadCalendar, errors } = useDashboard();
  const now = useClock(false);
  const [refreshing, setRefreshing] = useState(false);

  const defaultView = config?.calendarView.defaultView ?? "woche";
  const autoReturnMinutes = config?.calendarView.autoReturnMinutes ?? 5;

  const [view, setView] = useState<CalendarView>(defaultView);
  // Tag, den die Tagesansicht zeigt — per Tipp im Monatsraster wählbar.
  const [pickedDay, setPickedDay] = useState<Date | null>(null);
  // Monat, den das Monatsraster zeigt — per Wischen oder Pfeil-Buttons.
  const [pickedMonth, setPickedMonth] = useState<Date | null>(null);
  // Tagesblatt: Termine des Tages ansehen und neue anlegen.
  const [sheetDay, setSheetDay] = useState<Date | null>(null);
  const returnTimer = useRef<number | undefined>(undefined);

  // Solange nichts bedient wurde, folgt die Ansicht der Einstellung.
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current) setView(defaultView);
  }, [defaultView]);

  /**
   * Nach Inaktivität zur eingestellten Ansicht zurückkehren.
   *
   * Ein Panel im Flur soll nicht auf der Ansicht stehen bleiben, die jemand
   * vor Stunden geöffnet hat. Jede Bedienung setzt die Frist neu.
   */
  const scheduleReturn = useCallback(() => {
    window.clearTimeout(returnTimer.current);
    if (autoReturnMinutes <= 0) return;

    returnTimer.current = window.setTimeout(() => {
      touched.current = false;
      setView(defaultView);
      setPickedDay(null);
      setPickedMonth(null);
    }, autoReturnMinutes * 60_000);
  }, [autoReturnMinutes, defaultView]);

  const switchView = (next: CalendarView, day?: Date) => {
    touched.current = true;
    setView(next);
    if (day) setPickedDay(day);
    if (next !== defaultView || day) scheduleReturn();
    else window.clearTimeout(returnTimer.current);
  };

  useEffect(() => () => window.clearTimeout(returnTimer.current), []);

  const shownDay = pickedDay ?? now;
  const shownMonth = pickedMonth ?? now;

  const navigateDay = (delta: number) => switchView("tag", addDays(shownDay, delta));
  const navigateMonth = (delta: number) => {
    touched.current = true;
    setPickedMonth(new Date(shownMonth.getFullYear(), shownMonth.getMonth() + delta, 1));
    scheduleReturn();
  };

  // Wischen: nur horizontal, damit vertikales Scrollen (Tagesansicht, Woche)
  // unberührt bleibt — siehe useSwipe.ts. Ansicht wechseln bleibt bewusst den
  // Tabs vorbehalten: ein vertikaler Wisch würde sich sonst mit dem Scrollen
  // derselben Fläche in die Quere kommen.
  const daySwipe = useSwipe(
    () => navigateDay(1),
    () => navigateDay(-1),
  );
  const monthSwipe = useSwipe(
    () => navigateMonth(1),
    () => navigateMonth(-1),
  );

  const days = useMemo<DayBucket[]>(() => {
    const today = startOfDay(now);
    const buckets: DayBucket[] = [];

    for (let offset = 0; offset < DAYS_AHEAD; offset += 1) {
      const date = addDays(today, offset);
      buckets.push({ key: toDateKey(date), date, allDay: [], timed: [] });
    }

    const index = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    for (const event of calendar?.events ?? []) {
      const start = new Date(event.start);

      if (event.allDay) {
        // Mehrtägige Ganztagestermine an jedem betroffenen Tag zeigen.
        // Das Ende ist exklusiv (iCal-Konvention), daher der letzte Tag minus 1.
        const end = new Date(event.end);
        let cursor = startOfDay(start);
        while (cursor < end) {
          index.get(toDateKey(cursor))?.allDay.push(event);
          cursor = addDays(cursor, 1);
        }
        continue;
      }

      index.get(toDateKey(start))?.timed.push(event);
    }

    return buckets;
  }, [calendar, now]);

  const total = days.reduce(
    (sum, day) => sum + day.allDay.length + day.timed.length,
    0,
  );

  // Quellen, die gerade Aufmerksamkeit brauchen.
  const problems = (calendar?.feeds ?? []).filter(
    (feed) => feed.state === "error" || feed.state === "stale",
  );

  const monthTitle = new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(shownMonth);
  const dayTitle = `${relativeDayLabel(shownDay, now)}, ${formatDateShort(shownDay)}`;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshCalendar();
      await reloadCalendar();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Panel
      title={
        view === "monat" ? monthTitle : view === "tag" ? dayTitle : "Kalender"
      }
      className={className}
      icon={<CalendarDays size={13} strokeWidth={1.6} />}
      backdrop="calendar"
      meta={
        <span className="flex items-center gap-2">
          {/* Ansichtsumschalter */}
          <span className="flex overflow-hidden rounded-[3px] border border-white/[0.08]">
            {VIEW_LABELS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => switchView(entry.id)}
                className={cx(
                  "touchable -my-1 min-h-0 px-2.5 py-1.5 text-3xs uppercase tracking-wide2 lg:px-3",
                  view === entry.id
                    ? "bg-accent/[0.16] text-accent-soft"
                    : "text-zinc-500 active:bg-white/[0.04]",
                )}
              >
                {entry.label}
              </button>
            ))}
          </span>

          {/* Tagesnavigation, nur in der Tagesansicht */}
          {view === "tag" && (
            <span className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Vorheriger Tag"
                onClick={() => navigateDay(-1)}
                className="touchable -my-1 flex h-9 w-9 min-h-0 items-center justify-center rounded-[3px] border border-white/[0.08] text-zinc-500 active:border-accent/50 active:text-accent-soft"
              >
                <ChevronLeft size={14} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                aria-label="Nächster Tag"
                onClick={() => navigateDay(1)}
                className="touchable -my-1 flex h-9 w-9 min-h-0 items-center justify-center rounded-[3px] border border-white/[0.08] text-zinc-500 active:border-accent/50 active:text-accent-soft"
              >
                <ChevronRight size={14} strokeWidth={1.8} />
              </button>
            </span>
          )}

          {/* Monatsnavigation, nur im Monatsraster */}
          {view === "monat" && (
            <span className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Vorheriger Monat"
                onClick={() => navigateMonth(-1)}
                className="touchable -my-1 flex h-9 w-9 min-h-0 items-center justify-center rounded-[3px] border border-white/[0.08] text-zinc-500 active:border-accent/50 active:text-accent-soft"
              >
                <ChevronLeft size={14} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                aria-label="Nächster Monat"
                onClick={() => navigateMonth(1)}
                className="touchable -my-1 flex h-9 w-9 min-h-0 items-center justify-center rounded-[3px] border border-white/[0.08] text-zinc-500 active:border-accent/50 active:text-accent-soft"
              >
                <ChevronRight size={14} strokeWidth={1.8} />
              </button>
            </span>
          )}

          {view === "woche" && (
            <span className="digits hidden text-3xs text-zinc-600 2xl:inline">
              {total} Termine
            </span>
          )}

          <button
            type="button"
            onClick={refresh}
            aria-label="Kalender neu laden"
            className="touchable -my-1 flex h-9 w-9 min-h-0 items-center justify-center rounded-[3px] border border-white/[0.08] bg-white/[0.02] text-zinc-500 active:border-accent/50 active:text-accent-soft"
          >
            <RefreshCw
              size={14}
              strokeWidth={1.6}
              className={cx(refreshing && "animate-spin")}
            />
          </button>
        </span>
      }
      scroll={view === "woche"}
    >
      {pending.calendar ? (
        <LoadingState text="Lade Kalender …" />
      ) : view === "monat" ? (
        // touch-action: pan-y erlaubt dem Browser weiterhin senkrechtes
        // Scrollen (hier zwar ungenutzt, aber konsistent), verhindert aber,
        // dass er einen waagerechten Zug selbst als Scrollversuch deutet und
        // die Zeigerfolge per pointercancel abbricht, bevor unser eigener
        // pointerup-Handler die Wischrichtung auswerten kann.
        <div
          className="flex h-full min-h-0 flex-col"
          style={{ touchAction: "pan-y" }}
          {...monthSwipe}
        >
          <MonthGrid
            events={calendar?.events ?? []}
            now={now}
            month={shownMonth}
            onPickDay={(day) => {
              touched.current = true;
              scheduleReturn();
              setSheetDay(day);
            }}
          />
        </div>
      ) : view === "tag" ? (
        // DayView scrollt bereits selbst intern (siehe DayView.tsx) — dieser
        // Wrapper reicht nur die Wisch-Erkennung durch, ohne einen zweiten,
        // verschachtelten Scrollbereich aufzumachen. touch-action: pan-y wie
        // oben — sonst haelt der Browser jeden Zug fuer einen Scrollversuch
        // und bricht unsere Zeigerfolge per pointercancel ab.
        <div
          className="flex h-full min-h-0 flex-col"
          style={{ touchAction: "pan-y" }}
          {...daySwipe}
        >
          <DayView events={calendar?.events ?? []} day={shownDay} now={now} />
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={<CalendarDays size={26} strokeWidth={1.2} />}
          text={errors.calendar ?? "Keine Termine in den nächsten 7 Tagen"}
        />
      ) : (
        <div className="px-3 pb-3 pt-2">
          {days.map((day) => (
            <DaySection key={day.key} day={day} now={now} />
          ))}
        </div>
      )}

      {sheetDay && (
        <DaySheet
          day={sheetDay}
          events={calendar?.events ?? []}
          onClose={() => setSheetDay(null)}
          onOpenDayView={() => {
            const day = sheetDay;
            setSheetDay(null);
            switchView("tag", day);
          }}
        />
      )}

      {/* Meldungen der Quellen — die Adressen bleiben serverseitig, die
          Meldungen enthalten sie nie. */}
      {problems.length > 0 && (
        <div className="shrink-0 space-y-1 border-t border-white/[0.055] px-4 py-2">
          {problems.map((feed) => (
            <p
              key={feed.calendarId}
              className={cx(
                "flex items-start gap-2 text-3xs leading-relaxed",
                feed.state === "stale"
                  ? "text-signal-warn/85"
                  : "text-signal-err/85",
              )}
            >
              {feed.state === "stale" ? (
                <History size={11} strokeWidth={2} className="mt-px shrink-0" />
              ) : (
                <TriangleAlert
                  size={11}
                  strokeWidth={2}
                  className="mt-px shrink-0"
                />
              )}
              <span>
                <span className="text-zinc-300">{feed.name}</span>
                {" — "}
                {feed.message ?? "nicht erreichbar"}
              </span>
            </p>
          ))}
        </div>
      )}

      {/* Legende der Quellen */}
      {calendar?.feeds && calendar.feeds.length > 0 && (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 overflow-hidden border-t border-white/[0.055] bg-surface-800 px-4 py-2 short:max-h-[1.9rem] short:flex-nowrap">
          {/* Ohne Beschriftung wird die Legende leicht für einen Termin gehalten. */}
          <span className="label-dim shrink-0">Quellen</span>
          {calendar.feeds
            .filter((feed) => feed.state !== "disabled")
            .map((feed) => {
              const color =
                calendar.events.find(
                  (event) => event.calendarId === feed.calendarId,
                )?.calendarColor ?? "#71717a";
              return (
                <span
                  key={feed.calendarId}
                  className="flex items-center gap-1.5"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: color,
                      boxShadow: `0 0 7px ${withAlpha(color, 0.7)}`,
                    }}
                  />
                  <span className="text-3xs text-zinc-500">{feed.name}</span>
                  {feed.state === "error" && (
                    <TriangleAlert
                      size={10}
                      strokeWidth={2}
                      className="text-signal-err"
                      aria-label="Fehler"
                    />
                  )}
                  {feed.state === "stale" && (
                    <History
                      size={10}
                      strokeWidth={2}
                      className="text-signal-warn"
                      aria-label="Letzter bekannter Stand"
                    />
                  )}
                  {feed.state === "seed" && (
                    <span className="hidden text-3xs text-zinc-700 xl:inline">
                      demo
                    </span>
                  )}
                </span>
              );
            })}
        </div>
      )}
    </Panel>
  );
}

function DaySection({ day, now }: { day: DayBucket; now: Date }) {
  const isToday = toDateKey(now) === day.key;
  const empty = day.allDay.length === 0 && day.timed.length === 0;

  return (
    <section className="mb-1">
      {/* Tagesüberschrift */}
      <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2.5 bg-gradient-to-b from-surface-900/95 to-surface-900/80 px-1 py-1.5 backdrop-blur-sm">
        <span
          className={cx(
            "text-2xs font-medium uppercase tracking-wide2",
            isToday ? "text-accent-soft" : "text-zinc-400",
          )}
        >
          {relativeDayLabel(day.date, now)}
        </span>
        <span className="digits text-3xs text-zinc-600">
          {formatDateShort(day.date)}
        </span>
        <span className="hair ml-1 flex-1" />
        {!empty && (
          <span className="digits text-3xs text-zinc-700">
            {day.allDay.length + day.timed.length}
          </span>
        )}
      </div>

      {empty ? (
        <div className="py-1.5 pl-1 text-3xs text-zinc-700">frei</div>
      ) : (
        <div className="space-y-1 py-1">
          {day.allDay.map((event) => (
            <AllDayRow key={`${day.key}-${event.id}`} event={event} />
          ))}
          {day.timed.map((event) => (
            <TimedRow
              key={event.id}
              event={event}
              now={now}
              isToday={isToday}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Ganztägig: als durchgehender farbiger Streifen, klar abgesetzt von Uhrzeiten. */
function AllDayRow({ event }: { event: CalendarEvent }) {
  return (
    <div
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
  );
}

function TimedRow({
  event,
  now,
  isToday,
}: {
  event: CalendarEvent;
  now: Date;
  isToday: boolean;
}) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const running = isToday && start <= now && end >= now;
  const past = isToday && end < now;

  return (
    <div
      className={cx(
        "flex items-stretch gap-3 rounded-[3px] py-2 pl-1 pr-2.5 transition-opacity duration-200",
        past && "opacity-35",
        running && "bg-white/[0.035]",
      )}
      style={
        running
          ? {
              boxShadow: `inset 2px 0 0 0 ${event.calendarColor}, 0 0 26px -14px ${event.calendarColor}`,
            }
          : undefined
      }
    >
      <div className="digits w-[5.6rem] shrink-0 pt-px text-right">
        <div
          className={cx(
            "text-2xs leading-tight",
            running ? "text-zinc-100" : "text-zinc-300",
          )}
        >
          {formatTime(start)}
        </div>
        <div className="text-3xs leading-tight text-zinc-600">
          {formatTime(end)}
        </div>
      </div>

      <span className="event-bar" style={{ background: event.calendarColor }} />

      <div className="min-w-0 flex-1">
        <div
          className={cx(
            "truncate text-sm leading-tight",
            past ? "text-zinc-500" : "text-zinc-100",
            running && "font-medium",
          )}
        >
          {event.title}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-3xs text-zinc-600">
          <span className="truncate">{event.calendarName}</span>
          {event.location && (
            <>
              <span className="text-zinc-800">·</span>
              <span className="flex min-w-0 items-center gap-1">
                <MapPin size={9} strokeWidth={1.8} className="shrink-0" />
                <span className="truncate">{event.location}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {running && (
        <span className="shrink-0 self-center text-3xs font-medium uppercase tracking-wide2 text-accent-soft">
          jetzt
        </span>
      )}
    </div>
  );
}
