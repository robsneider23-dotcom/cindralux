import { ChevronRight, CloudRain, Droplets, MapPin, Wind } from "lucide-react";
import { useState } from "react";
import { useWeatherData } from "@/lib/store";
import { formatTemp, formatWeekdayShort, toDateKey } from "@/lib/format";
import { cx } from "@/lib/utils";
import { Panel, EmptyState, LoadingState } from "./Panel";
import { WeatherGlyph, weatherColor } from "./WeatherGlyph";
import { WeatherDetailOverlay } from "./weather/WeatherDetailOverlay";
import { WeekList } from "./weather/WeekList";

/** Wetter mit aktuellem Wert, Tageshoch/-tief und 7-Tage-Vorschau. */
export function WeatherCard({ className }: { className?: string }) {
  const { data: weather, loading, error } = useWeatherData();
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!weather) {
    return (
      <Panel title="Wetter" className={className}>
        <div className="py-10">
          {(loading && weather === null) ? (
            <LoadingState text="Lade Wetterdaten …" />
          ) : (
            <EmptyState text={error ?? "Keine Wetterdaten"} />
          )}
        </div>
      </Panel>
    );
  }

  const todayKey = toDateKey(new Date());
  const forecast = weather.forecast
    .filter((day) => day.date >= todayKey)
    .slice(0, 6);

  // Gemeinsame Temperaturskala fuer alle Balken der Vorschau.
  const allTemps = forecast.flatMap((day) => [day.min, day.max]);
  const scaleMin = Math.min(...allTemps, weather.temperature);
  const scaleMax = Math.max(...allTemps, weather.temperature);
  const span = Math.max(1, scaleMax - scaleMin);

  return (
    <>
      <Panel
        title="Wetter"
        className={cx("weather-panel", className)}
        backdrop="weather"
        onActivate={() => setDetailsOpen(true)}
        activateLabel="Wetterdetails öffnen"
        meta={
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin size={11} strokeWidth={1.6} className="shrink-0" />
            <span className="truncate" title={weather.locationName}>{weather.locationName}</span>
            {weather.source === "seed" && (
              <span className="text-signal-warn">· Demo</span>
            )}
            <ChevronRight
              size={12}
              strokeWidth={2}
              className="ml-0.5 text-zinc-600"
            />
          </span>
        }
        bodyClassName="flex flex-col"
      >
        {/* Aktuell — Kennwerte stehen neben der Temperatur, damit die Karte
          auch in einer schmalen Spalte flach bleibt. */}
        <div className="flex items-center gap-3.5 px-4 pt-3.5 short:gap-2.5 short:pt-2">
          <div
            className="relative shrink-0"
            style={{
              filter: `drop-shadow(0 0 22px ${weatherColor(weather.icon)}55)`,
            }}
          >
            <WeatherGlyph
              icon={weather.icon}
              size={48}
              strokeWidth={1.1}
              className="short:hidden"
            />
            <WeatherGlyph
              icon={weather.icon}
              size={36}
              strokeWidth={1.2}
              className="hidden short:block"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <span className="digits text-[clamp(1.8rem,3.4vw,2.7rem)] font-light leading-none text-zinc-100 short:text-[1.5rem]">
                {formatTemp(weather.temperature)}
              </span>

              <span className="digits shrink-0 text-2xs leading-none">
                <span className="text-signal-warn">
                  {formatTemp(weather.high)}
                </span>
                <span className="mx-1 text-zinc-700">/</span>
                <span className="text-signal-info">
                  {formatTemp(weather.low)}
                </span>
              </span>

              <span className="weather-extra digits ml-auto hidden shrink-0 items-center gap-2.5 text-3xs text-zinc-500 2xl:flex">
                <span className="flex items-center gap-1">
                  <CloudRain size={11} strokeWidth={1.6} />
                  {weather.precipitationChance} %
                </span>
                <span className="flex items-center gap-1">
                  <Wind size={11} strokeWidth={1.6} />
                  {weather.windSpeed}
                </span>
                <span className="hidden items-center gap-1 2xl:flex">
                  <Droplets size={11} strokeWidth={1.6} />
                  {weather.humidity} %
                </span>
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-2 short:mt-1">
              <span className="truncate text-sm text-zinc-400 short:text-2xs">
                {weather.description}
              </span>
              <span className="weather-apparent digits hidden shrink-0 text-3xs text-zinc-600 2xl:block">
                gefühlt {formatTemp(weather.apparentTemperature)}
              </span>
            </div>
          </div>
        </div>

        <div className="hair mx-4 my-3 short:my-1.5" />

        {/* Balkenvorschau entfällt: in der hohen Spalte liest sich die Liste besser. */}
        <div className="hidden">
          {forecast.map((day) => {
            const isToday = day.date === todayKey;
            const top = ((scaleMax - day.max) / span) * 100;
            const bottom = ((day.min - scaleMin) / span) * 100;

            return (
              <div
                key={day.date}
                className={cx(
                  "flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-[3px] px-1 py-2 transition-colors duration-200 short:gap-1 short:py-1",
                  isToday &&
                    "bg-accent/[0.07] ring-1 ring-inset ring-accent/20",
                )}
              >
                <span
                  className={cx(
                    "text-3xs uppercase tracking-wide2",
                    isToday ? "text-accent-soft" : "text-zinc-500",
                  )}
                >
                  {isToday
                    ? "Heute"
                    : formatWeekdayShort(`${day.date}T12:00:00`)}
                </span>

                <WeatherGlyph icon={day.icon} size={20} strokeWidth={1.3} />

                {/* Temperaturspanne als vertikaler Balken */}
                <div className="relative w-[3px] flex-1 rounded-full bg-white/[0.05]">
                  <span
                    className="absolute inset-x-0 rounded-full"
                    style={{
                      top: `${top}%`,
                      bottom: `${bottom}%`,
                      background: "linear-gradient(180deg, #fbbf24, #38bdf8)",
                      opacity: isToday ? 1 : 0.55,
                      minHeight: 4,
                    }}
                  />
                </div>

                <span className="digits text-2xs leading-none text-zinc-200">
                  {Math.round(day.max)}°
                </span>
                <span className="digits text-3xs leading-none text-zinc-600 short:hidden">
                  {Math.round(day.min)}°
                </span>

                {day.precipitationChance >= 30 && (
                  <span className="digits text-3xs leading-none text-signal-info short:hidden">
                    {day.precipitationChance}%
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/*
        Kompakte Vorschau für flache Panels: eine Zeile mit Tag, Symbol und
        Höchstwert. Das Balkendiagramm bräuchte gut 85px Höhe, die bei
        1024x600 an anderer Stelle fehlen.
      */}
        {/* Flache Panels: eine Zeile. Sonst die volle Wochenliste. */}
        <div className="hidden h-[3.5rem] shrink-0 items-stretch gap-px px-2 pb-2 short:flex">
          {forecast.slice(0, 6).map((day) => {
            const isToday = day.date === todayKey;
            return (
              <div
                key={day.date}
                className={cx(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[3px] px-0.5",
                  isToday &&
                    "bg-accent/[0.09] ring-1 ring-inset ring-accent/20",
                )}
              >
                <span
                  className={cx(
                    "text-3xs uppercase leading-none tracking-wide2",
                    isToday ? "text-accent-soft" : "text-zinc-500",
                  )}
                >
                  {isToday
                    ? "Heute"
                    : formatWeekdayShort(`${day.date}T12:00:00`)}
                </span>
                <WeatherGlyph icon={day.icon} size={16} strokeWidth={1.4} />
                <span className="digits text-2xs leading-none text-zinc-200">
                  {Math.round(day.max)}°
                </span>
              </div>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-3 pb-3 short:hidden">
          <WeekList weather={weather} variant="card" />
        </div>
      </Panel>

      {detailsOpen && (
        <WeatherDetailOverlay
          weather={weather}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </>
  );
}
