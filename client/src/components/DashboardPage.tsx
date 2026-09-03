import { CalendarTimeline } from "./CalendarTimeline";
import { LauncherBar } from "./LauncherBar";
import { TodayAgenda } from "./TodayAgenda";
import { TrashPickupCard } from "./TrashPickupCard";
import { WeatherCard } from "./WeatherCard";

/**
 * Hauptbildschirm.
 *
 * Dauerhaft sichtbar ist nur, was man im Vorbeigehen liest, ohne etwas
 * anzutippen: Tagesübersicht, Müllabholung, Kalender und Wetter. Smart Home,
 * Messwerte und Assistent liegen hinter der Startleiste am unteren Rand und
 * öffnen sich auf Tipp als Fenster — das gibt dem Kalender den Platz, den die
 * Monatsansicht braucht.
 */
export function DashboardPage() {
  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-2.5">
        {/* Heute */}
        <div className="col-span-4 flex min-h-0 min-w-0 flex-col gap-2.5 xl:col-span-3">
          <TodayAgenda className="min-h-0 flex-1" />
          <TrashPickupCard className="shrink-0" />
        </div>

        {/* Kalender — Tag, Woche oder Monat */}
        <CalendarTimeline className="col-span-5 min-h-0 min-w-0 xl:col-span-6" />

        {/* Wetter */}
        <div className="col-span-3 flex min-h-0 min-w-0 flex-col gap-2.5">
          <WeatherCard className="min-h-0 flex-1" />
        </div>
      </div>

      <LauncherBar className="h-[5.5rem] shrink-0 short:h-[4.25rem]" />
    </>
  );
}
