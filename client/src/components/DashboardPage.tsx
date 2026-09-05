import { Fragment } from "react";
import type { LayoutColumn } from "@shared/types";
import { LauncherBar } from "./LauncherBar";
import { panelDefinition } from "./dashboard/panelRegistry";
import { useDashboard } from "@/lib/store";
import { presetColumns } from "@/lib/layouts";
import { cx } from "@/lib/utils";

/**
 * Hauptbildschirm.
 *
 * Welche Panels wo stehen, kommt aus den Einstellungen — entweder aus einer
 * der Vorlagen oder aus der eigenen Anordnung. Was nicht im Raster liegt, ist
 * deshalb nicht weg: Smart Home, Messwerte, Assistent und Liste öffnen sich
 * weiterhin über die Startleiste als Fenster.
 */

/**
 * Breiten als feste Klassen, nicht zusammengesetzt.
 *
 * Tailwind liest die Klassennamen beim Bauen aus dem Quelltext. Ein
 * `col-span-${n}` stünde nirgends im Text und landete nie im Stylesheet —
 * die Spalte wäre dann stillschweigend volle Breite.
 */
const SPAN_KLASSE: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  5: "col-span-5",
  6: "col-span-6",
  7: "col-span-7",
  8: "col-span-8",
  9: "col-span-9",
  10: "col-span-10",
  11: "col-span-11",
  12: "col-span-12",
};

export function DashboardPage() {
  const { config } = useDashboard();

  const layout = config?.layout;
  const spalten: LayoutColumn[] =
    layout?.preset === "custom"
      ? (layout.custom ?? [])
      : presetColumns(layout?.preset ?? "standard");

  // Leere Anordnung (alles abgewählt) würde eine schwarze Fläche ergeben —
  // dann lieber die Standardvorlage als sichtbaren Hinweis, dass etwas fehlt.
  const sichtbar = spalten.filter((spalte) => spalte.panels.length > 0);
  const gezeichnet = sichtbar.length > 0 ? sichtbar : presetColumns("standard");

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-2.5">
        {gezeichnet.map((spalte, index) => (
          <div
            key={`${index}-${spalte.panels.join("-")}`}
            className={cx(
              SPAN_KLASSE[Math.min(12, Math.max(1, spalte.span))],
              "flex min-h-0 min-w-0 flex-col gap-2.5",
            )}
          >
            {spalte.panels.map((panelId) => {
              const panel = panelDefinition(panelId);
              if (!panel) return null;
              return (
                <Fragment key={panelId}>
                  {panel.render(panel.grow ? "min-h-0 flex-1" : "shrink-0")}
                </Fragment>
              );
            })}
          </div>
        ))}
      </div>

      <LauncherBar className="h-[5.5rem] shrink-0 short:h-[4.25rem]" />
    </>
  );
}
