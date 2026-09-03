import { AlertTriangle, Clock3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { PhotoItem } from '@shared/types';
import { api } from '@/lib/api';
import { useDashboard } from '@/lib/store';
import { useClock } from '@/hooks/useClock';
import { formatDateLong, formatTemp, formatTime, formatWeekday, toDateKey } from '@/lib/format';
import { cx, withAlpha } from '@/lib/utils';
import { WeatherGlyph } from '../WeatherGlyph';
import { PhotoSlideshow } from './PhotoSlideshow';
import { Portal } from '../Portal';

/**
 * Ruhebildschirm.
 *
 * Wenn das Panel eine Weile nicht bedient wurde, bleibt nur das Wesentliche:
 * Uhrzeit, Wetter und was heute noch ansteht. Dahinter läuft die Diashow.
 * Alles andere verschwindet — ein Panel im Flur soll im Ruhezustand ruhig sein.
 */
export function IdleScreen({ onWake }: { onWake: () => void }) {
  const { config, weather, calendar, trash } = useDashboard();
  const now = useClock(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  const idle = config?.idle;
  const slideshow = idle?.slideshow;

  // Bilder erst laden, wenn der Ruhemodus wirklich beginnt.
  useEffect(() => {
    if (!slideshow?.enabled) return;
    api
      .activePhotos()
      .then(setPhotos)
      .catch(() => setPhotos([]));
  }, [slideshow?.enabled]);

  /** Was heute noch kommt — Vergangenes interessiert im Ruhezustand nicht. */
  const upcoming = useMemo(() => {
    const key = toDateKey(now);
    return (calendar?.events ?? [])
      .filter((event) => {
        if (toDateKey(new Date(event.start)) !== key) return false;
        return event.allDay || new Date(event.end) >= now;
      })
      .slice(0, 4);
  }, [calendar, now]);

  const urgentTrash = trash?.next?.isToday || trash?.next?.isTomorrow ? trash.next : null;
  const hasPhotos = photos.length > 0 && slideshow?.enabled;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[75] overflow-hidden bg-surface-900 animate-fade-in"
        onPointerDown={onWake}
      >
        {hasPhotos && slideshow && (
          <PhotoSlideshow photos={photos} config={slideshow} className="absolute inset-0" />
        )}

        {/* Ohne Bilder trägt der Rubicon-Hintergrund die Fläche. */}
        {!hasPhotos && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40"
            style={{
              backgroundImage: config?.appearance.background
                ? `url(/rubicon/${config.appearance.background})`
                : undefined,
            }}
          />
        )}

        {/* Verlauf, damit die Schrift auf jedem Bild lesbar bleibt. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.25) 38%, rgba(0,0,0,0.35) 62%, rgba(0,0,0,0.85) 100%)',
          }}
        />

        <div className="relative flex h-full flex-col justify-between p-[4vh]">
          {/* Oben: Uhr und Datum */}
          {idle?.showClock !== false && (
            <div>
              <div className="digits text-[clamp(4rem,13vw,11rem)] font-extralight leading-none tracking-tight text-zinc-50">
                {String(now.getHours()).padStart(2, '0')}
                <span className="mx-2 text-accent/80">:</span>
                {String(now.getMinutes()).padStart(2, '0')}
              </div>
              <div className="mt-3 text-[clamp(1rem,2vw,1.6rem)] font-light text-zinc-300">
                {formatWeekday(now)}, {formatDateLong(now)}
              </div>
            </div>
          )}

          {/* Unten: Wetter und Termine */}
          <div className="flex flex-wrap items-end justify-between gap-8">
            {idle?.showAgenda !== false && (
              <div className="min-w-0 max-w-2xl">
                {urgentTrash && (
                  <div
                    className="mb-4 inline-flex items-center gap-2.5 rounded-[3px] border px-4 py-2.5"
                    style={{
                      borderColor: withAlpha(urgentTrash.color, 0.5),
                      background: withAlpha(urgentTrash.color, 0.14),
                      color: urgentTrash.color,
                    }}
                  >
                    <AlertTriangle size={16} strokeWidth={1.9} />
                    <span className="text-sm">
                      {urgentTrash.label} {urgentTrash.isToday ? 'heute' : 'morgen'}
                    </span>
                  </div>
                )}

                {upcoming.length > 0 ? (
                  <ul className="space-y-2">
                    {upcoming.map((event) => (
                      <li key={event.id} className="flex items-center gap-3">
                        <span
                          className="h-7 w-1 shrink-0 rounded-full"
                          style={{ background: event.calendarColor }}
                        />
                        <span className="digits w-24 shrink-0 text-[clamp(0.85rem,1.3vw,1.05rem)] text-zinc-300">
                          {event.allDay ? 'ganztägig' : formatTime(event.start)}
                        </span>
                        <span className="truncate text-[clamp(0.95rem,1.5vw,1.25rem)] text-zinc-50">
                          {event.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-zinc-400">
                    <Clock3 size={15} strokeWidth={1.6} />
                    Heute steht nichts mehr an.
                  </p>
                )}
              </div>
            )}

            {idle?.showWeather !== false && weather && (
              <div className="flex items-center gap-5">
                <WeatherGlyph icon={weather.icon} size={64} strokeWidth={1} />
                <div>
                  <div className="digits text-[clamp(2.5rem,5vw,4rem)] font-extralight leading-none text-zinc-50">
                    {formatTemp(weather.temperature)}
                  </div>
                  <div className="mt-2 text-sm text-zinc-300">{weather.description}</div>
                  <div className="digits mt-1 text-2xs text-zinc-500">
                    {formatTemp(weather.low)} / {formatTemp(weather.high)} · {weather.locationName}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <p
          className={cx(
            'absolute inset-x-0 bottom-3 text-center text-3xs uppercase tracking-label text-zinc-600',
          )}
        >
          Bildschirm berühren
        </p>
      </div>
    </Portal>
  );
}
