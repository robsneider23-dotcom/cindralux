import { CalendarPlus, Clock3, ExternalLink, MapPin, Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { CalendarEvent } from '@shared/types';
import { api } from '@/lib/api';
import { useDashboard } from '@/lib/store';
import { formatDateLong, formatTime, formatWeekday, toDateKey } from '@/lib/format';
import { cx, withAlpha } from '@/lib/utils';
import { Portal } from '../Portal';

/** Voreinstellungen für die Dauer, damit man nicht zweimal tippen muss. */
const DURATIONS = [30, 60, 90, 120];

/**
 * Tagesblatt: zeigt die Termine eines Tages und legt neue an.
 *
 * Öffnet sich per Tipp auf einen Tag im Monatsraster — das Datum steht damit
 * schon fest, es bleibt nur Titel und Uhrzeit. Auf einem Touchpanel ist das
 * der kürzeste Weg zu einem neuen Termin.
 */
export function DaySheet({
  day,
  events,
  onClose,
  onOpenDayView,
}: {
  day: Date;
  events: CalendarEvent[];
  onClose: () => void;
  onOpenDayView: () => void;
}) {
  const { config, reloadCalendar } = useDashboard();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const connected = config?.google.connected ?? false;

  /** Endzeit aus Beginn und Dauer — der Nutzer soll nur einmal tippen. */
  const endTime = (() => {
    const [h, m] = startTime.split(':').map(Number);
    const total = ((h ?? 0) * 60 + (m ?? 0) + duration) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  })();

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await api.createEvent({
        title: title.trim(),
        date: toDateKey(day),
        allDay,
        startTime: allDay ? undefined : startTime,
        endTime: allDay ? undefined : endTime,
        location: location.trim() || undefined,
      });
      setResult({ ok: response.ok, message: response.message });
      if (response.ok) {
        setTitle('');
        setLocation('');
        setCreating(false);
        await reloadCalendar();
      }
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  };

  // Nur die Termine dieses Tages; mehrtägige Ganztagestermine zählen mit.
  const key = toDateKey(day);
  const ofDay = events.filter((event) => {
    if (event.allDay) {
      // Ueber Datumsschluessel vergleichen: Zeitzonen verschieben Mitternacht.
      return toDateKey(new Date(event.start)) <= key && key < toDateKey(new Date(event.end));
    }
    return toDateKey(new Date(event.start)) === key;
  });

  const sorted = [...ofDay].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[69] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl animate-fade-in"
        onClick={onClose}
      >
        <div
          className="panel scanlines noise flex max-h-full w-full max-w-2xl flex-col bg-surface-800 animate-panel-in"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="panel-head">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-3.5 w-[2px] shrink-0 rounded-full"
                style={{ background: 'rgb(var(--accent))', boxShadow: '0 0 10px rgb(var(--accent))' }}
              />
              <h2 className="label truncate text-zinc-300">{formatWeekday(day)}</h2>
              <span className="digits text-3xs text-zinc-600">{formatDateLong(day)}</span>
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

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {/* Termine des Tages */}
            {sorted.length === 0 ? (
              <p className="py-6 text-center text-2xs uppercase tracking-wide2 text-zinc-600">
                Keine Termine an diesem Tag
              </p>
            ) : (
              <div className="space-y-1.5">
                {sorted.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 rounded-[3px] border px-3.5 py-3"
                    style={{
                      borderColor: withAlpha(event.calendarColor, 0.3),
                      background: withAlpha(event.calendarColor, 0.08),
                    }}
                  >
                    <span
                      className="mt-0.5 h-8 w-1 shrink-0 rounded-full"
                      style={{ background: event.calendarColor }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-zinc-50">{event.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-3 text-3xs text-zinc-500">
                        <span className="digits flex items-center gap-1">
                          <Clock3 size={10} strokeWidth={1.8} />
                          {event.allDay
                            ? 'ganztägig'
                            : `${formatTime(event.start)}–${formatTime(event.end)}`}
                        </span>
                        {event.location && (
                          <span className="flex min-w-0 items-center gap-1">
                            <MapPin size={10} strokeWidth={1.8} />
                            <span className="truncate">{event.location}</span>
                          </span>
                        )}
                        <span>{event.calendarName}</span>
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Neuer Termin */}
            {creating ? (
              <div className="mt-4 rounded-[3px] border border-accent/30 bg-accent/[0.05] p-4">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Worum geht es?"
                  autoFocus
                  className="field mb-3"
                />

                <div className="mb-3 flex gap-1.5">
                  {[
                    { id: false, label: 'Mit Uhrzeit' },
                    { id: true, label: 'Ganztägig' },
                  ].map((entry) => (
                    <button
                      key={String(entry.id)}
                      type="button"
                      onClick={() => setAllDay(entry.id)}
                      className={cx(
                        'touchable flex-1 rounded-[3px] border text-2xs uppercase tracking-wide2',
                        allDay === entry.id
                          ? 'border-accent/50 bg-accent/15 text-accent-soft'
                          : 'border-white/[0.08] bg-white/[0.02] text-zinc-400',
                      )}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>

                {!allDay && (
                  <div className="mb-3 flex flex-wrap items-end gap-3">
                    <label className="block">
                      <span className="label mb-2 block">Beginn</span>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(event) => setStartTime(event.target.value)}
                        className="field digits w-36"
                      />
                    </label>

                    <span className="min-w-0 flex-1">
                      <span className="label mb-2 block">Dauer — bis {endTime}</span>
                      <span className="flex gap-1.5">
                        {DURATIONS.map((minutes) => (
                          <button
                            key={minutes}
                            type="button"
                            onClick={() => setDuration(minutes)}
                            className={cx(
                              'touchable min-h-[52px] flex-1 rounded-[3px] border text-2xs',
                              duration === minutes
                                ? 'border-accent/50 bg-accent/15 text-accent-soft'
                                : 'border-white/[0.08] bg-white/[0.02] text-zinc-400',
                            )}
                          >
                            {minutes < 60 ? `${minutes} Min` : `${minutes / 60} Std`}
                          </button>
                        ))}
                      </span>
                    </span>
                  </div>
                )}

                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Ort (optional)"
                  className="field mb-4"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="btn min-h-[56px] px-5"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={busy || !title.trim() || !connected}
                    className="btn btn-accent min-h-[56px] flex-1"
                  >
                    <CalendarPlus size={17} strokeWidth={1.8} />
                    In Google eintragen
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="btn btn-accent min-h-[56px] flex-1"
                >
                  <Plus size={18} strokeWidth={2} />
                  Termin eintragen
                </button>
                <button type="button" onClick={onOpenDayView} className="btn min-h-[56px] px-5">
                  <ExternalLink size={16} strokeWidth={1.7} />
                  Tagesansicht
                </button>
              </div>
            )}

            {/* Rückmeldung und Voraussetzung */}
            {result && (
              <p
                className={cx(
                  'mt-3 text-3xs leading-relaxed',
                  result.ok ? 'text-signal-ok/90' : 'text-signal-err/90',
                )}
              >
                {result.message}
              </p>
            )}

            {!connected && (
              <p className="mt-3 rounded-[3px] border border-signal-warn/25 bg-signal-warn/[0.06] px-3.5 py-3 text-3xs leading-relaxed text-zinc-400">
                Zum Eintragen muss ein Google-Konto verbunden sein — in eine ICS-Adresse lässt
                sich grundsätzlich nicht schreiben. Einstellungen → Kalender → Google Kalender,
                Anleitung in <span className="digits">docs/google-kalender.md</span>.
              </p>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
