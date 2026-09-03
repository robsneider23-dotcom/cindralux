import { useClock } from "@/hooks/useClock";
import { formatDateLong, formatWeekday } from "@/lib/format";
import { cx } from "@/lib/utils";

/**
 * Uhr der Statusleiste. Die Ziffern sind bewusst gross und tabellarisch —
 * auf zwei Meter Entfernung ist das die wichtigste Information des Panels.
 */
export function ClockPanel({
  showSeconds,
  className,
}: {
  showSeconds: boolean;
  className?: string;
}) {
  const now = useClock(showSeconds);

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return (
    <div className={cx("flex items-center gap-4 lg:gap-5", className)}>
      <div className="flex items-baseline">
        <span className="digits text-glow text-[clamp(2.1rem,5.4vw,4.25rem)] font-light leading-none text-zinc-100 short:text-[clamp(1.9rem,4vw,2.6rem)]">
          {hours}
        </span>
        {/* Der Doppelpunkt pulst im Sekundentakt statt einer tickenden Ziffer */}
        <span className="digits mx-1 animate-pulse-soft text-[clamp(1.8rem,4.4vw,3.5rem)] font-light leading-none text-accent short:text-[clamp(1.6rem,3.2vw,2.2rem)]">
          :
        </span>
        <span className="digits text-glow text-[clamp(2.1rem,5.4vw,4.25rem)] font-light leading-none text-zinc-100 short:text-[clamp(1.9rem,4vw,2.6rem)]">
          {minutes}
        </span>
        {showSeconds && (
          <span className="digits ml-2 self-end pb-1.5 text-[clamp(0.9rem,1.5vw,1.25rem)] font-light leading-none text-zinc-600">
            {seconds}
          </span>
        )}
      </div>

      <div className="min-w-0 border-l border-white/[0.07] pl-4 lg:pl-5">
        <div className="text-[clamp(0.85rem,1.3vw,1.05rem)] font-medium leading-tight text-zinc-200">
          {formatWeekday(now)}
        </div>
        <div className="digits mt-0.5 text-[clamp(0.7rem,1vw,0.85rem)] leading-tight text-zinc-500">
          {formatDateLong(now)}
        </div>
      </div>
    </div>
  );
}
