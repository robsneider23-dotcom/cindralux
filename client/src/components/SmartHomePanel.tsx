import { House } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { HomeAssistantAction } from "@shared/types";
import { api } from "@/lib/api";
import { useDashboard } from "@/lib/store";
import { cx } from "@/lib/utils";
import { SmartHomeActionTile, type TileState } from "./SmartHomeActionTile";

/**
 * Smart-Home-Dock am unteren Rand. Bewusst als volle Breite ausgeführt:
 * die Schnellaktionen sind das, was man im Vorbeigehen antippt.
 */
export function SmartHomePanel({
  className,
  variant = "panel",
}: {
  className?: string;
  /** `overlay` lässt Gehäuse und Kopfzeile weg — die liefert das Fenster. */
  variant?: "panel" | "overlay";
}) {
  const { config, homeAssistant, reloadHomeAssistant } = useDashboard();
  const [feedback, setFeedback] = useState<string | null>(null);
  // Zustände nach einem Service-Call sofort übernehmen, statt auf das
  // nächste Polling zu warten — sonst wirkt die Kachel träge.
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});

  const actions = config?.smartHomeActions ?? [];
  const mock = homeAssistant?.mode !== "live";

  const states = useMemo(() => {
    const map = new Map<string, string>();
    for (const entity of homeAssistant?.entities ?? [])
      map.set(entity.entityId, entity.state);
    for (const [id, state] of Object.entries(optimistic)) map.set(id, state);
    return map;
  }, [homeAssistant, optimistic]);

  const stateOf = (action: HomeAssistantAction): TileState => {
    if (!action.entityId || action.entityId === "all") return "off";
    const value = states.get(action.entityId);
    if (value === "unavailable") return "unavailable";
    if (value === "on" || value === "heat" || value === "playing") return "on";
    if (value === undefined) return "unknown";
    return "off";
  };

  const trigger = useCallback(
    async (action: HomeAssistantAction) => {
      const currentlyOn = stateOf(action) === "on";
      // Bei Toggle-Kacheln entscheidet der aktuelle Zustand, welcher Service läuft.
      const service =
        action.kind === "toggle" && currentlyOn
          ? (action.serviceOff ?? "turn_off")
          : action.service;

      try {
        const result = await api.callService({
          domain: action.domain,
          service,
          entityId: action.entityId,
          serviceData: action.serviceData,
        });

        if (result.entity) {
          setOptimistic((prev) => ({
            ...prev,
            [result.entity!.entityId]: result.entity!.state,
          }));
        }
        if (action.entityId === "all" && service.includes("off")) {
          setOptimistic((prev) => {
            const next = { ...prev };
            for (const item of actions) {
              if (item.entityId && item.entityId !== "all")
                next[item.entityId] = "off";
            }
            return next;
          });
        }

        setFeedback(result.message);
        void reloadHomeAssistant();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : String(error));
      } finally {
        window.setTimeout(() => setFeedback(null), 3200);
      }
    },
    // stateOf und actions haengen an denselben Quellen wie states.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actions, states, reloadHomeAssistant],
  );

  const tiles = (
    <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 lg:grid-cols-4">
      {actions.map((action) => (
        <SmartHomeActionTile
          key={action.id}
          action={action}
          state={stateOf(action)}
          mock={mock}
          onTrigger={trigger}
        />
      ))}
    </div>
  );

  // Im Fenster liefert der Rahmen die Kopfzeile — hier nur die Kacheln.
  if (variant === "overlay") {
    return (
      <div className={className}>
        {tiles}
        {feedback && (
          <p className="px-4 pb-3 text-3xs uppercase tracking-wide2 text-zinc-500">
            {feedback}
          </p>
        )}
      </div>
    );
  }

  return (
    <section
      // Kein shrink-0 hier: Ob das Panel waechst oder seine Hoehe behaelt,
      // entscheidet die Stelle, die es platziert (Raster oder Fenster).
      className={cx("panel scanlines noise flex flex-col", className)}
    >
      <header className="panel-head relative z-10">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-3.5 w-[2px] shrink-0 rounded-full"
            style={{
              background: "rgb(var(--accent))",
              boxShadow: "0 0 10px rgb(var(--accent))",
            }}
          />
          <House
            size={13}
            strokeWidth={1.6}
            className="shrink-0 text-zinc-500"
          />
          <h2 className="label truncate text-zinc-400">Smart Home</h2>
          {mock && (
            <span className="shrink-0 rounded-[2px] border border-signal-warn/25 bg-signal-warn/[0.07] px-1.5 py-0.5 text-3xs uppercase tracking-wide2 text-signal-warn">
              Simulation
            </span>
          )}
        </div>

        {/* Rückmeldung des letzten Service-Calls */}
        <div
          className={cx(
            "label-dim min-w-0 truncate transition-opacity duration-300",
            feedback ? "opacity-100" : "opacity-0",
          )}
        >
          {feedback ?? "—"}
        </div>
      </header>

      {/*
        Spalten nach der eigenen Breite, nicht nach der des Bildschirms:
        Als Panel im Raster kann dieselbe Komponente ein Viertel breit sein
        wie auch die ganze Zeile. Viewport-Breakpoints (sm:, lg:) wussten
        davon nichts und quetschten sechs Kacheln in eine schmale Spalte —
        auto-fit richtet sich nach dem Platz, der tatsaechlich da ist.
      */}
      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2 p-2.5 short:gap-1.5 short:p-2">
        {actions.map((action) => (
          <SmartHomeActionTile
            key={action.id}
            action={action}
            state={stateOf(action)}
            mock={mock}
            onTrigger={trigger}
          />
        ))}
      </div>
    </section>
  );
}
