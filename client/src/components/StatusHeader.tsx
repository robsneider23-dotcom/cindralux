import { Cpu, Settings2, Thermometer, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import type { HealthResponse } from "@shared/types";
import { api } from "@/lib/api";
import { useDashboard } from "@/lib/store";
import { formatTemp } from "@/lib/format";
import { ClockPanel } from "./ClockPanel";
import { ConnectionStatusPill, type StatusTone } from "./ConnectionStatusPill";
import { WeatherGlyph } from "./WeatherGlyph";

/**
 * Kopfleiste: Marke, Uhr, Wetter-Kurzinfo und die Verbindungszustaende.
 * Rechts sitzt der Zugang zu den Einstellungen — der einzige Navigationspunkt,
 * damit im Kiosk-Modus keine Browser-Navigation noetig ist.
 */
export function StatusHeader({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const { config, weather, errors } = useDashboard();
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    const load = () =>
      api
        .health()
        .then(setHealth)
        .catch(() => setHealth(null));
    load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const sysTone: StatusTone = !health
    ? "err"
    : health.system.memoryUsedPercent > 90 || (health.system.temperatureC ?? 0) > 80
      ? "warn"
      : "ok";

  const sysDetail = health
    ? [
        `RAM ${health.system.memoryUsedPercent} %`,
        `Last ${health.system.loadAverage.toFixed(2)}`,
        health.system.temperatureC !== null ? `${health.system.temperatureC.toFixed(0)} °C` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : (errors.config ?? "Offline");

  return (
    <header className="panel relative z-10 flex shrink-0 items-center gap-4 overflow-hidden px-4 py-3 short:py-2 lg:gap-5 lg:px-5">
      {/* Marke */}
      <div className="flex shrink-0 items-center gap-3.5">
        <img
          src="/cindralux/logo-mark.svg"
          alt=""
          className="h-11 w-11 shrink-0 short:h-9 short:w-9"
        />
        <div className="hidden min-w-0 leading-none sm:block">
          <div className="text-[clamp(0.95rem,1.4vw,1.2rem)] font-semibold tracking-[0.16em] text-zinc-100">
            CINDRALUX
          </div>
          <div className="label-dim mt-1.5">Home Command Center</div>
        </div>
      </div>

      <span className="h-11 w-px shrink-0 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      <ClockPanel
        showSeconds={config?.appearance.showSeconds ?? true}
        className="shrink-0"
      />

      {/* Wetter-Kurzinfo — waechst mit der Breite mit */}
      {weather && (
        <>
          <span className="hidden h-11 w-px shrink-0 bg-gradient-to-b from-transparent via-white/10 to-transparent xl:block" />
          <div className="hidden min-w-0 shrink items-center gap-3 xl:flex">
            <WeatherGlyph icon={weather.icon} size={32} />
            <div className="min-w-0 leading-none">
              <div className="digits text-[clamp(1.2rem,1.9vw,1.6rem)] font-light text-zinc-100">
                {formatTemp(weather.temperature)}
              </div>
              <div className="mt-1.5 hidden max-w-[9rem] truncate text-3xs text-zinc-500 2xl:block">
                {weather.description}
              </div>
            </div>
            <div className="hidden flex-col gap-1.5 2xl:flex">
              <span className="digits flex items-center gap-1.5 text-3xs text-zinc-500">
                <Thermometer size={12} strokeWidth={1.5} />
                {formatTemp(weather.low)} / {formatTemp(weather.high)}
              </span>
              <span className="digits flex items-center gap-1.5 text-3xs text-zinc-500">
                <Wind size={12} strokeWidth={1.5} />
                {weather.windSpeed} km/h
              </span>
            </div>
          </div>
        </>
      )}

      {/* Verbindungszustaende — rechtsbuendig. Home Assistant und AI sind in
          die Einstellungen gewandert (dort stehen sie ohnehin direkt neben
          ihrer Konfiguration); System bleibt hier fuer den Blick auf einen. */}
      <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
        <div className="hidden items-center gap-2 md:flex">
          <ConnectionStatusPill
            label="System"
            tone={sysTone}
            detail={sysDetail}
            icon={<Cpu size={13} strokeWidth={1.6} />}
          />
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Einstellungen öffnen"
          className="touchable flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.028] text-zinc-400 active:border-accent/50 active:bg-accent/15 active:text-accent-soft short:h-12 short:w-12"
        >
          <Settings2 size={22} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
