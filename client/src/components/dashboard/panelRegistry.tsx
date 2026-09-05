import { Activity, CalendarDays, House, ListChecks, Sparkles, Sun, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type { DashboardPanelId } from "@shared/types";
import { Panel } from "../Panel";
import { AiAssistantPanel } from "../AiAssistantPanel";
import { CalendarTimeline } from "../CalendarTimeline";
import { ListsPanel } from "../ListsPanel";
import { SensorPanel } from "../SensorPanel";
import { SmartHomePanel } from "../SmartHomePanel";
import { TodayAgenda } from "../TodayAgenda";
import { TrashPickupCard } from "../TrashPickupCard";
import { WeatherCard } from "../WeatherCard";

/**
 * Was sich ins Dashboard-Raster legen laesst.
 *
 * Eine Stelle fuer alle Panels: Das Raster (DashboardPage) zeichnet daraus,
 * die Einstellungen bauen daraus ihre Auswahlliste. Neue Panels tragen sich
 * hier ein und erscheinen automatisch an beiden Stellen.
 *
 * `grow` trennt die zwei Sorten: Die meisten Panels fuellen die Spalte aus,
 * die Muellabholung ist eine Karte mit fester Hoehe — laesst man sie wachsen,
 * steht in der Mitte viel Luft um drei Zeilen Text.
 *
 * Vier Panels bringen ihr Gehaeuse selbst mit, zwei (Messwerte, Liste)
 * liefern nur Inhalt, weil sie fuer die Fenster der Startleiste gebaut sind —
 * die bekommen es hier umgehaengt.
 */
export interface PanelDefinition {
  id: DashboardPanelId;
  label: string;
  icon: ReactNode;
  /** Fuellt die Spalte aus. Ohne das behaelt das Panel seine natuerliche Hoehe. */
  grow: boolean;
  render: (className: string) => ReactNode;
}

export const PANEL_DEFINITIONS: PanelDefinition[] = [
  {
    id: "agenda",
    label: "Heute",
    icon: <CalendarDays size={14} strokeWidth={1.7} />,
    grow: true,
    render: (className) => <TodayAgenda className={className} />,
  },
  {
    id: "calendar",
    label: "Kalender",
    icon: <CalendarDays size={14} strokeWidth={1.7} />,
    grow: true,
    render: (className) => <CalendarTimeline className={className} />,
  },
  {
    id: "weather",
    label: "Wetter",
    icon: <Sun size={14} strokeWidth={1.7} />,
    grow: true,
    render: (className) => <WeatherCard className={className} />,
  },
  {
    id: "trash",
    label: "Müllabholung",
    icon: <Trash2 size={14} strokeWidth={1.7} />,
    grow: false,
    render: (className) => <TrashPickupCard className={className} />,
  },
  {
    id: "smarthome",
    label: "Smart Home",
    icon: <House size={14} strokeWidth={1.7} />,
    grow: true,
    render: (className) => <SmartHomePanel className={className} />,
  },
  {
    id: "sensors",
    label: "Messwerte",
    icon: <Activity size={14} strokeWidth={1.7} />,
    grow: true,
    render: (className) => (
      <Panel
        title="Zuhause"
        icon={<Activity size={13} strokeWidth={1.6} />}
        backdrop="sensors"
        className={className}
        scroll
      >
        <SensorPanel />
      </Panel>
    ),
  },
  {
    id: "lists",
    label: "Liste",
    icon: <ListChecks size={14} strokeWidth={1.7} />,
    grow: true,
    render: (className) => (
      <Panel
        title="Liste"
        icon={<ListChecks size={13} strokeWidth={1.6} />}
        backdrop="lists"
        className={className}
        bodyClassName="flex flex-col overflow-hidden"
      >
        <ListsPanel />
      </Panel>
    ),
  },
  {
    id: "assistant",
    label: "Assistent",
    icon: <Sparkles size={14} strokeWidth={1.7} />,
    grow: true,
    render: (className) => <AiAssistantPanel className={className} />,
  },
];

const NACH_ID = new Map(PANEL_DEFINITIONS.map((eintrag) => [eintrag.id, eintrag]));

export function panelDefinition(id: DashboardPanelId): PanelDefinition | undefined {
  return NACH_ID.get(id);
}
