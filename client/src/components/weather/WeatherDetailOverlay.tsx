import {
  Cloudy,
  Droplets,
  Gauge,
  MapPin,
  Sun,
  Sunrise,
  Sunset,
  Umbrella,
  Wind,
  X,
} from "lucide-react";
import { useEffect } from "react";
import type { WeatherSummary } from "@shared/types";
import { formatTemp, formatTime } from "@/lib/format";
import { WeatherGlyph, weatherColor } from "../WeatherGlyph";
import { HourlyChart } from "./HourlyChart";
import { WeekList } from "./WeekList";
import { Portal } from "../Portal";

/** Gradzahl in eine Himmelsrichtung übersetzen. */
function compass(degrees: number): string {
  const points = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
  return points[Math.round(degrees / 45) % 8] ?? "N";
}

/** UV-Index nach WHO-Stufen benennen. */
function uvLabel(value: number): string {
  if (value < 3) return "niedrig";
  if (value < 6) return "mäßig";
  if (value < 8) return "hoch";
  if (value < 11) return "sehr hoch";
  return "extrem";
}

/**
 * Detailfenster für das Wetter.
 *
 * Öffnet sich mittig über dem Dashboard und zeigt alles, was die Karte aus
 * Platzgründen weglässt: Tagesverlauf, Sonnenzeiten, Wind, Druck, UV und die
 * volle Wochenvorschau.
 */
export function WeatherDetailOverlay({
  weather,
  onClose,
}: {
  weather: WeatherSummary;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const details = weather.details;
  const today = weather.forecast[0];

  const stats = [
    {
      icon: Wind,
      label: "Wind",
      value: `${weather.windSpeed} km/h`,
      hint: `aus ${compass(details.windDirection)} · Böen ${details.windGusts} km/h`,
    },
    {
      icon: Droplets,
      label: "Luftfeuchte",
      value: `${weather.humidity} %`,
      hint: `gefühlt ${formatTemp(weather.apparentTemperature)}`,
    },
    {
      icon: Gauge,
      label: "Luftdruck",
      value: `${details.pressure} hPa`,
      hint: details.pressure >= 1013 ? "über Normaldruck" : "unter Normaldruck",
    },
    {
      icon: Cloudy,
      label: "Bewölkung",
      value: `${details.cloudCover} %`,
      hint: weather.description,
    },
    {
      icon: Sun,
      label: "UV-Index",
      value: details.uvIndexMax.toFixed(1),
      hint: uvLabel(details.uvIndexMax),
    },
    {
      icon: Umbrella,
      label: "Niederschlag",
      value: `${(today?.precipitationSum ?? 0).toFixed(1)} mm`,
      hint: `${weather.precipitationChance} % Wahrscheinlichkeit`,
    },
  ];

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[68] flex items-center justify-center bg-black/90 p-3 backdrop-blur-xl animate-fade-in md:p-6"
        onClick={onClose}
      >
        <div
          className="panel scanlines noise flex max-h-full w-full max-w-5xl flex-col bg-surface-800 animate-panel-in"
          // Klick im Fenster darf nicht durchschlagen und es schließen.
          onClick={(event) => event.stopPropagation()}
        >
          <header className="panel-head">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-3.5 w-[2px] shrink-0 rounded-full"
                style={{
                  background: "rgb(var(--accent))",
                  boxShadow: "0 0 10px rgb(var(--accent))",
                }}
              />
              <h2 className="label text-zinc-300">Wetter</h2>
              <span className="label-dim flex items-center gap-1.5">
                <MapPin size={11} strokeWidth={1.7} />
                {weather.locationName}
              </span>
              {weather.source === "seed" && (
                <span className="label-dim text-signal-warn">Demodaten</span>
              )}
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

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
            {/* Aktuell */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div className="flex items-center gap-5">
                <span
                  style={{
                    filter: `drop-shadow(0 0 26px ${weatherColor(weather.icon)}55)`,
                  }}
                >
                  <WeatherGlyph icon={weather.icon} size={72} strokeWidth={1} />
                </span>
                <div>
                  <div className="digits text-[clamp(3rem,6vw,4.5rem)] font-extralight leading-none text-zinc-50">
                    {formatTemp(weather.temperature)}
                  </div>
                  <div className="mt-2 text-sm text-zinc-400">
                    {weather.description}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <div className="digits text-2xl font-light leading-none text-signal-warn">
                    {formatTemp(weather.high)}
                  </div>
                  <div className="label-dim mt-2">Höchstwert</div>
                </div>
                <div>
                  <div className="digits text-2xl font-light leading-none text-signal-info">
                    {formatTemp(weather.low)}
                  </div>
                  <div className="label-dim mt-2">Tiefstwert</div>
                </div>
              </div>

              {/* Sonnenzeiten */}
              <div className="ml-auto flex items-center gap-5">
                <span className="flex items-center gap-2.5">
                  <Sunrise
                    size={20}
                    strokeWidth={1.4}
                    className="text-signal-warn"
                  />
                  <span>
                    <span className="digits block text-sm leading-none text-zinc-200">
                      {details.sunrise ? formatTime(details.sunrise) : "—"}
                    </span>
                    <span className="label-dim mt-1.5 block">Aufgang</span>
                  </span>
                </span>
                <span className="flex items-center gap-2.5">
                  <Sunset size={20} strokeWidth={1.4} className="text-accent" />
                  <span>
                    <span className="digits block text-sm leading-none text-zinc-200">
                      {details.sunset ? formatTime(details.sunset) : "—"}
                    </span>
                    <span className="label-dim mt-1.5 block">Untergang</span>
                  </span>
                </span>
              </div>
            </div>

            <div className="hair my-5" />

            {/* Tagesverlauf */}
            <h3 className="label mb-1 text-zinc-400">Nächste 24 Stunden</h3>
            <HourlyChart hours={weather.hourly} />

            <div className="hair my-5" />

            {/* Kennwerte */}
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[3px] border border-white/[0.07] bg-white/[0.015] px-3.5 py-3"
                >
                  <stat.icon
                    size={16}
                    strokeWidth={1.5}
                    className="mb-2.5 text-zinc-500"
                  />
                  <div className="digits text-base leading-none text-zinc-100">
                    {stat.value}
                  </div>
                  <div className="label-dim mt-2">{stat.label}</div>
                  <div
                    className="mt-1.5 truncate text-3xs text-zinc-600"
                    title={stat.hint}
                  >
                    {stat.hint}
                  </div>
                </div>
              ))}
            </div>

            <div className="hair my-5" />

            {/* Wochenvorschau */}
            <h3 className="label mb-3 text-zinc-400">Nächste 7 Tage</h3>
            <WeekList weather={weather} />
          </div>
        </div>
      </div>
    </Portal>
  );
}
