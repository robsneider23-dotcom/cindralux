import {
  Blinds,
  Clapperboard,
  CookingPot,
  Flame,
  Lamp,
  Lock,
  type LucideProps,
  Moon,
  Music4,
  Power,
} from "lucide-react";
import { useState } from "react";
import type { HomeAssistantAction, SmartHomeIcon } from "@shared/types";
import { cx, withAlpha } from "@/lib/utils";

const ICONS: Record<SmartHomeIcon, React.ComponentType<LucideProps>> = {
  "power-off": Power,
  lamp: Lamp,
  kitchen: CookingPot,
  movie: Clapperboard,
  night: Moon,
  blinds: Blinds,
  heating: Flame,
  music: Music4,
  coffee: CookingPot,
  lock: Lock,
};

export type TileState = "on" | "off" | "unavailable" | "unknown";

interface TileProps {
  action: HomeAssistantAction;
  state: TileState;
  /** Simulationsmodus — wird als dezenter Hinweis auf der Kachel gezeigt. */
  mock: boolean;
  onTrigger: (action: HomeAssistantAction) => Promise<void>;
}

/**
 * Große Touch-Kachel. Der aktive Zustand ist bewusst kräftig: aus zwei Metern
 * Entfernung muss auf einen Blick erkennbar sein, was an ist.
 */
export function SmartHomeActionTile({
  action,
  state,
  mock,
  onTrigger,
}: TileProps) {
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);

  const Icon = ICONS[action.icon] ?? Lamp;
  const accent = action.accent ?? "rgb(255, 90, 31)";
  const isOn = state === "on";
  const unavailable = state === "unavailable";

  const trigger = async () => {
    if (busy || unavailable) return;
    setBusy(true);
    try {
      await onTrigger(action);
      // Kurze Quittung, damit auch Szenen ohne Zustand eine Rückmeldung geben.
      setFlash(true);
      window.setTimeout(() => setFlash(false), 620);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={trigger}
      disabled={unavailable}
      aria-pressed={action.kind === "toggle" ? isOn : undefined}
      className={cx(
        "touchable group flex h-full min-h-[104px] flex-col justify-between overflow-hidden short:min-h-0",
        "rounded-[3px] border p-3.5 text-left shadow-tile short:p-2.5",
        unavailable && "cursor-not-allowed opacity-40",
        isOn ? "border-transparent" : "border-white/[0.07]",
      )}
      style={{
        background: isOn
          ? `linear-gradient(155deg, ${withAlpha(accent, 0.34)}, ${withAlpha(accent, 0.08)} 74%), #0d0d0d`
          : "linear-gradient(180deg, rgba(255,255,255,0.028), rgba(0,0,0,0.25))",
        boxShadow: isOn
          ? `inset 0 0 0 1px ${withAlpha(accent, 0.55)}, 0 0 40px -10px ${withAlpha(accent, 0.95)}`
          : undefined,
      }}
    >
      {/* Leuchtkante am oberen Rand — aus der Entfernung der klarste Marker. */}
      {isOn && (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{
            background: accent,
            boxShadow: `0 0 14px 1px ${withAlpha(accent, 0.9)}`,
          }}
        />
      )}

      {/* Quittungs-Aufblitzen */}
      <span
        className={cx(
          "pointer-events-none absolute inset-0 transition-opacity duration-500 ease-calm",
          flash ? "opacity-100" : "opacity-0",
        )}
        style={{
          background: `radial-gradient(90% 70% at 50% 0%, ${withAlpha(accent, 0.4)}, transparent 70%)`,
        }}
      />

      <div className="relative flex w-full items-start justify-between gap-2 short:items-center">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] transition-colors duration-200 short:h-8 short:w-8"
          style={{
            background: isOn
              ? withAlpha(accent, 0.3)
              : "rgba(255,255,255,0.04)",
            color: isOn ? accent : "#a1a1aa",
            boxShadow: isOn
              ? `0 0 20px -6px ${withAlpha(accent, 0.9)}`
              : "none",
          }}
        >
          <Icon
            size={20}
            strokeWidth={1.5}
            className={cx(busy && "animate-pulse")}
          />
        </span>

        {/* Zustandsanzeige */}
        {action.kind === "toggle" ? (
          <span
            className={cx(
              "mt-1 flex h-6 w-11 shrink-0 items-center rounded-full border px-[3px] transition-all duration-300 ease-calm",
              isOn ? "justify-end" : "justify-start",
            )}
            style={{
              borderColor: isOn
                ? withAlpha(accent, 0.6)
                : "rgba(255,255,255,0.1)",
              background: isOn ? withAlpha(accent, 0.2) : "rgba(0,0,0,0.4)",
            }}
          >
            <span
              className="block h-[18px] w-[18px] rounded-full transition-colors duration-300"
              style={{
                background: isOn ? accent : "#3f3f46",
                boxShadow: isOn ? `0 0 12px ${withAlpha(accent, 0.9)}` : "none",
              }}
            />
          </span>
        ) : (
          <span className="mt-1.5 text-3xs uppercase tracking-wide2 text-zinc-600 transition-colors group-active:text-accent-soft">
            Szene
          </span>
        )}
      </div>

      <div className="relative mt-2.5 min-w-0 short:mt-1.5">
        <div
          className={cx(
            "truncate text-[clamp(0.85rem,1.15vw,1rem)] font-medium leading-tight",
            isOn ? "text-zinc-50" : "text-zinc-200",
          )}
        >
          {action.label}
        </div>
        {/* Zusatzzeile entfaellt auf flachen Schirmen — dort zaehlt nur das Label. */}
        <div className="mt-1 flex items-center gap-1.5 short:hidden">
          <span className="truncate text-3xs text-zinc-500">
            {unavailable
              ? "Nicht erreichbar"
              : (action.hint ?? `${action.domain}.${action.service}`)}
          </span>
          {mock && !unavailable && (
            <span
              className="shrink-0 text-3xs text-zinc-700"
              title="Simulationsmodus"
            >
              sim
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
