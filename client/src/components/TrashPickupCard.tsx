import { AlertTriangle, Trash2 } from "lucide-react";
import type { TrashPickup } from "@shared/types";
import { useTrashData } from "@/lib/store";
import { formatWeekday, formatDateShort } from "@/lib/format";
import { cx, withAlpha } from "@/lib/utils";
import { Panel, EmptyState, LoadingState } from "./Panel";

/** Nur ein Datum: die Tonnen, die am selben Tag rausmuessen, stehen zusammen. */
function groupSameDay(pickups: TrashPickup[]): TrashPickup[][] {
  const groups = new Map<string, TrashPickup[]>();
  for (const pickup of pickups) {
    const list = groups.get(pickup.date) ?? [];
    list.push(pickup);
    groups.set(pickup.date, list);
  }
  return [...groups.values()];
}

function dayLabel(pickup: TrashPickup): string {
  if (pickup.isToday) return "Heute";
  if (pickup.isTomorrow) return "Morgen";
  return formatWeekday(`${pickup.date}T12:00:00`);
}

/**
 * Muellabholung. Ist heute oder morgen etwas faellig, wechselt die Karte in
 * einen Warnzustand mit Glow — das ist die Information, die man vom Sofa aus
 * sehen muss, ohne hinzugehen.
 */
export function TrashPickupCard({ className }: { className?: string }) {
  const { data: trash, loading, error } = useTrashData();

  if ((loading && trash === null)) {
    return (
      <Panel
        title="Müllabholung"
        className={className}
        icon={<Trash2 size={13} strokeWidth={1.6} />}
      >
        <div className="py-8">
          <LoadingState text="Lade Abfuhrtermine …" />
        </div>
      </Panel>
    );
  }

  if (!trash || trash.upcoming.length === 0) {
    return (
      <Panel
        title="Müllabholung"
        className={className}
        icon={<Trash2 size={13} strokeWidth={1.6} />}
      >
        <EmptyState
          icon={<Trash2 size={26} strokeWidth={1.2} />}
          text={error ?? "Keine Abfuhrtermine hinterlegt"}
        />
      </Panel>
    );
  }

  const groups = groupSameDay(trash.upcoming).slice(0, 3);
  const nextGroup = groups[0] ?? [];
  const first = nextGroup[0] as TrashPickup;
  const urgent = first.isToday || first.isTomorrow;
  const laterGroups = groups.slice(1);

  return (
    <Panel
      title="Müllabholung"
      backdrop="trash"
      className={cx(className, urgent && "ring-1 ring-inset ring-accent/25")}
      icon={<Trash2 size={13} strokeWidth={1.6} />}
      meta={
        urgent ? (
          <span className="text-accent-soft">Bald fällig</span>
        ) : undefined
      }
      bodyClassName="flex flex-col"
    >
      {/* Naechste Abholung */}
      <div
        className={cx(
          "relative flex items-center gap-4 px-4 py-3.5",
          urgent && "overflow-hidden",
        )}
        style={
          urgent
            ? {
                background: `linear-gradient(100deg, ${withAlpha(first.color, 0.14)}, transparent 68%)`,
              }
            : undefined
        }
      >
        {/* Farbstapel der faelligen Tonnen */}
        <div className="flex shrink-0 items-end gap-1.5">
          {nextGroup.map((pickup) => (
            <span
              key={pickup.id}
              className="block w-2.5 rounded-full"
              style={{
                height: 46,
                background: pickup.color,
                boxShadow: urgent
                  ? `0 0 18px ${withAlpha(pickup.color, 0.2)}`
                  : "none",
              }}
            />
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cx(
                "text-[clamp(1.1rem,1.8vw,1.45rem)] font-medium leading-none",
                urgent ? "text-zinc-50" : "text-zinc-200",
              )}
            >
              {dayLabel(first)}
            </span>
            {urgent && (
              <AlertTriangle
                size={16}
                strokeWidth={1.8}
                className="shrink-0 text-accent animate-pulse-soft"
              />
            )}
          </div>
          <div className="mt-1.5 truncate text-sm text-zinc-400">
            {nextGroup.map((pickup) => pickup.label).join(" · ")}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="digits text-2xs text-zinc-500">
            {formatDateShort(`${first.date}T12:00:00`)}
          </div>
          {!urgent && (
            <div className="digits mt-1 text-3xs text-zinc-600">
              in {first.daysUntil} Tagen
            </div>
          )}
        </div>
      </div>

      {/* Danach */}
      {laterGroups.length > 0 && (
        <>
          <div className="hair mx-4" />
          <div className="flex-1 px-4 py-2.5">
            {laterGroups.map((group) => {
              const entry = group[0] as TrashPickup;
              return (
                <div
                  key={entry.date}
                  className="flex items-center gap-3 py-1.5"
                >
                  <div className="flex shrink-0 gap-1">
                    {group.map((pickup) => (
                      <span
                        key={pickup.id}
                        className="block h-2.5 w-2.5 rounded-full"
                        style={{ background: pickup.color, opacity: 0.75 }}
                      />
                    ))}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-2xs text-zinc-400">
                    {group.map((pickup) => pickup.label).join(" · ")}
                  </span>
                  <span className="digits shrink-0 text-3xs text-zinc-600">
                    {formatWeekday(`${entry.date}T12:00:00`).slice(0, 2)}
                    {"  "}
                    {formatDateShort(`${entry.date}T12:00:00`)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
