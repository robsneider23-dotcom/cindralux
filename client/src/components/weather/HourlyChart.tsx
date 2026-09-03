import { useEffect, useMemo, useRef, useState } from "react";
import type { WeatherHour } from "@shared/types";
import { formatTime } from "@/lib/format";

/**
 * Tagesverlauf: Temperatur als Linie, Regenwahrscheinlichkeit als Balken.
 *
 * Bewusst zwei übereinanderliegende Diagramme mit gemeinsamer Zeitachse statt
 * einer zweiten y-Achse — zwei Größen mit verschiedener Skala in einem
 * Koordinatensystem sind praktisch immer irreführend.
 *
 * Die Farben sind gegen die dunkle Fläche geprüft: Bernstein #d97706 und
 * Blau #0284c7 liegen im Helligkeitsband für dunkle Oberflächen und trennen
 * sich auch bei Rot-Grün- und Blau-Gelb-Schwäche deutlich (ΔE > 23).
 */

const TEMP_COLOR = "#d97706";
const RAIN_COLOR = "#0284c7";

const PLOT = { temp: 128, rain: 54, axis: 24, gap: 10 };
const PAD = { left: 38, right: 12, top: 18 };

export function HourlyChart({ hours }: { hours: WeatherHour[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  // Echte Pixelbreite messen statt den viewBox zu strecken — sonst würden
  // die Linienstärken horizontal verzerrt.
  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry?.contentRect.width ?? 0);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const height = PLOT.temp + PLOT.gap + PLOT.rain + PLOT.axis;
  const innerWidth = Math.max(0, width - PAD.left - PAD.right);

  const geometry = useMemo(() => {
    if (hours.length === 0 || innerWidth <= 0) return null;

    const temps = hours.map((hour) => hour.temperature);
    const rawMin = Math.min(...temps);
    const rawMax = Math.max(...temps);
    // Etwas Luft, damit die Kurve die Ränder nicht berührt.
    const pad = Math.max(1, (rawMax - rawMin) * 0.18);
    const min = Math.floor(rawMin - pad);
    const max = Math.ceil(rawMax + pad);
    const span = Math.max(1, max - min);

    const step =
      hours.length > 1 ? innerWidth / (hours.length - 1) : innerWidth;
    const x = (index: number) => PAD.left + index * step;
    const y = (value: number) =>
      PAD.top + (1 - (value - min) / span) * (PLOT.temp - PAD.top);

    const line = hours
      .map(
        (hour, index) =>
          `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(hour.temperature).toFixed(1)}`,
      )
      .join(" ");

    const area = `${line} L${x(hours.length - 1).toFixed(1)},${PLOT.temp} L${x(0).toFixed(1)},${PLOT.temp} Z`;

    // Balkenbreite mit 2px Fuge zwischen benachbarten Balken.
    const barWidth = Math.max(3, step - 2);

    return {
      min,
      max,
      step,
      x,
      y,
      line,
      area,
      barWidth,
      warmestIndex: temps.indexOf(rawMax),
      coldestIndex: temps.indexOf(rawMin),
    };
  }, [hours, innerWidth]);

  if (hours.length === 0) {
    return (
      <p className="py-8 text-center text-2xs uppercase tracking-wide2 text-zinc-600">
        Kein Stundenverlauf verfügbar
      </p>
    );
  }

  const rainTop = PLOT.temp + PLOT.gap;
  const current = active !== null ? hours[active] : undefined;
  const maxRain = Math.max(...hours.map((hour) => hour.precipitationChance));

  const onPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!geometry) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const relative = event.clientX - rect.left - PAD.left;
    const index = Math.round(relative / geometry.step);
    setActive(Math.min(hours.length - 1, Math.max(0, index)));
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* Ablesewert beim Wischen über das Diagramm */}
      <div className="mb-2 flex h-9 flex-wrap items-center gap-x-4 gap-y-1">
        {current ? (
          <>
            <span className="digits text-2xs text-zinc-300">
              {formatTime(current.time)}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: TEMP_COLOR }}
              />
              <span className="digits text-2xs text-zinc-200">
                {Math.round(current.temperature)} °C
              </span>
              <span className="digits text-3xs text-zinc-600">
                gefühlt {Math.round(current.apparent)}°
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: RAIN_COLOR }}
              />
              <span className="digits text-2xs text-zinc-200">
                {current.precipitationChance} %
              </span>
            </span>
            <span className="digits text-3xs text-zinc-600">
              {current.windSpeed} km/h Wind
            </span>
          </>
        ) : (
          <span className="text-3xs uppercase tracking-wide2 text-zinc-600">
            Über das Diagramm streichen für Stundenwerte
          </span>
        )}
      </div>

      {/* Beide Plots benennen — so trägt keine Farbe allein die Bedeutung. */}
      <div className="mb-1 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-3xs uppercase tracking-wide2 text-zinc-500">
          <span
            className="h-[2px] w-4 rounded-full"
            style={{ background: TEMP_COLOR }}
          />
          Temperatur
        </span>
        <span className="flex items-center gap-1.5 text-3xs uppercase tracking-wide2 text-zinc-500">
          <span
            className="h-2 w-2 rounded-[1px]"
            style={{ background: RAIN_COLOR }}
          />
          Regenwahrscheinlichkeit
        </span>
      </div>

      <svg
        width={width || undefined}
        height={height}
        viewBox={`0 0 ${Math.max(1, width)} ${height}`}
        className="block w-full touch-pan-y"
        role="img"
        aria-label={`Tagesverlauf über ${hours.length} Stunden: Temperatur zwischen ${geometry?.min ?? 0} und ${geometry?.max ?? 0} Grad, dazu die Regenwahrscheinlichkeit je Stunde.`}
        onPointerDown={onPointer}
        onPointerMove={(event) => event.buttons > 0 && onPointer(event)}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id="temp-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TEMP_COLOR} stopOpacity="0.28" />
            <stop offset="100%" stopColor={TEMP_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {geometry && (
          <>
            {/* Zurückhaltendes Raster: drei Linien genügen zur Orientierung. */}
            {[0, 0.5, 1].map((fraction) => {
              const value =
                geometry.min + (geometry.max - geometry.min) * (1 - fraction);
              const y = PAD.top + fraction * (PLOT.temp - PAD.top);
              return (
                <g key={fraction}>
                  <line
                    x1={PAD.left}
                    y1={y}
                    x2={width - PAD.right}
                    y2={y}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="1"
                  />
                  <text
                    x={PAD.left - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    className="fill-zinc-600"
                    style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}
                  >
                    {Math.round(value)}°
                  </text>
                </g>
              );
            })}

            <path d={geometry.area} fill="url(#temp-area)" />
            <path
              d={geometry.line}
              fill="none"
              stroke={TEMP_COLOR}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Nur Höchst- und Tiefstwert direkt beschriften, nicht jeden Punkt. */}
            {[geometry.warmestIndex, geometry.coldestIndex].map(
              (index, order) => {
                const hour = hours[index];
                if (!hour) return null;
                return (
                  <g key={`${index}-${order}`}>
                    <circle
                      cx={geometry.x(index)}
                      cy={geometry.y(hour.temperature)}
                      r="4"
                      fill={TEMP_COLOR}
                      stroke="#0d0d0d"
                      strokeWidth="2"
                    />
                    <text
                      x={geometry.x(index)}
                      y={geometry.y(hour.temperature) - 9}
                      textAnchor="middle"
                      className="fill-zinc-300"
                      style={{
                        fontSize: 11,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {Math.round(hour.temperature)}°
                    </text>
                  </g>
                );
              },
            )}

            {/* Regenwahrscheinlichkeit */}
            {hours.map((hour, index) => {
              if (hour.precipitationChance <= 0) return null;
              // Mindesthöhe, damit auch 3 % noch als Balken erkennbar sind.
              const barHeight = Math.max(
                2,
                (hour.precipitationChance / 100) * PLOT.rain,
              );
              return (
                <rect
                  key={hour.time}
                  x={geometry.x(index) - geometry.barWidth / 2}
                  y={rainTop + PLOT.rain - barHeight}
                  width={geometry.barWidth}
                  height={barHeight}
                  rx="2"
                  fill={RAIN_COLOR}
                  opacity={active === index ? 1 : 0.72}
                />
              );
            })}
            {/* Grundlinie und Skala des Regen-Plots */}
            <line
              x1={PAD.left}
              y1={rainTop + PLOT.rain}
              x2={width - PAD.right}
              y2={rainTop + PLOT.rain}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
            <line
              x1={PAD.left}
              y1={rainTop + PLOT.rain / 2}
              x2={width - PAD.right}
              y2={rainTop + PLOT.rain / 2}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={rainTop + 9}
              textAnchor="end"
              className="fill-zinc-600"
              style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}
            >
              100
            </text>
            <text
              x={PAD.left - 8}
              y={rainTop + PLOT.rain + 3}
              textAnchor="end"
              className="fill-zinc-700"
              style={{ fontSize: 10 }}
            >
              0
            </text>

            {/* Ohne nennenswerten Regen den leeren Plot erklären. */}
            {maxRain < 5 && (
              <text
                x={PAD.left + (width - PAD.left - PAD.right) / 2}
                y={rainTop + PLOT.rain / 2 + 4}
                textAnchor="middle"
                className="fill-zinc-700"
                style={{ fontSize: 11 }}
              >
                kein nennenswerter Regen erwartet
              </text>
            )}

            {/* Zeitachse: alle vier Stunden eine Marke. */}
            {hours.map((hour, index) => {
              if (index % 4 !== 0) return null;
              return (
                <text
                  key={hour.time}
                  x={geometry.x(index)}
                  y={height - 6}
                  textAnchor="middle"
                  className="fill-zinc-600"
                  style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}
                >
                  {formatTime(hour.time)}
                </text>
              );
            })}

            {/* Fadenkreuz */}
            {active !== null && hours[active] && (
              <g pointerEvents="none">
                <line
                  x1={geometry.x(active)}
                  y1={PAD.top - 6}
                  x2={geometry.x(active)}
                  y2={rainTop + PLOT.rain}
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth="1"
                />
                <circle
                  cx={geometry.x(active)}
                  cy={geometry.y(hours[active].temperature)}
                  r="5"
                  fill={TEMP_COLOR}
                  stroke="#0d0d0d"
                  strokeWidth="2"
                />
              </g>
            )}
          </>
        )}
      </svg>

      {/* Dieselben Werte als Tabelle — für Screenreader und als Rückfallebene. */}
      <table className="sr-only">
        <caption>Stundenwerte</caption>
        <thead>
          <tr>
            <th>Uhrzeit</th>
            <th>Temperatur</th>
            <th>Regenwahrscheinlichkeit</th>
            <th>Wind</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((hour) => (
            <tr key={hour.time}>
              <td>{formatTime(hour.time)}</td>
              <td>{Math.round(hour.temperature)} °C</td>
              <td>{hour.precipitationChance} %</td>
              <td>{hour.windSpeed} km/h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
