import type { ReactNode } from "react";
import { cx } from "@/lib/utils";

export type StatusTone = "ok" | "warn" | "err" | "idle" | "accent";

const TONE: Record<
  StatusTone,
  { dot: string; text: string; border: string; bg: string }
> = {
  ok: {
    dot: "#34d399",
    text: "text-signal-ok",
    border: "border-signal-ok/15",
    bg: "bg-signal-ok/[0.04]",
  },
  warn: {
    dot: "#fbbf24",
    text: "text-signal-warn",
    border: "border-signal-warn/25",
    bg: "bg-signal-warn/[0.07]",
  },
  err: {
    dot: "#f43f5e",
    text: "text-signal-err",
    border: "border-signal-err/25",
    bg: "bg-signal-err/[0.07]",
  },
  idle: {
    dot: "#71717a",
    text: "text-zinc-500",
    border: "border-white/10",
    bg: "bg-white/[0.02]",
  },
  accent: {
    dot: "rgb(var(--accent))",
    text: "text-accent-soft",
    border: "border-accent/30",
    bg: "bg-accent/[0.08]",
  },
};

/** Pulsierender Statuspunkt. */
function StatusDot({
  tone,
  pulse = false,
  size = 7,
}: {
  tone: StatusTone;
  pulse?: boolean;
  size?: number;
}) {
  const color = TONE[tone].dot;
  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
    >
      {pulse && (
        <span
          className="absolute inset-0 rounded-full animate-pulse-soft"
          style={{ background: color, filter: "blur(4px)", opacity: 0.75 }}
        />
      )}
      <span
        className="relative rounded-full"
        style={{
          width: size,
          height: size,
          background: color,
          boxShadow: "0 0 0 3px rgb(var(--hairline) / 0.04)",
        }}
      />
    </span>
  );
}

interface PillProps {
  label: string;
  tone: StatusTone;
  /** Zweite Zeile, z.B. "Simulation" oder eine Fehlermeldung. */
  detail?: string;
  icon?: ReactNode;
  pulse?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Verbindungsanzeige in der Statusleiste. Als Button ausgefuehrt, sobald ein
 * onClick vorliegt — dann ist die Flaeche gross genug fuer den Finger.
 */
export function ConnectionStatusPill({
  label,
  tone,
  detail,
  icon,
  pulse,
  onClick,
  className,
}: PillProps) {
  const style = TONE[tone];
  const Element = onClick ? "button" : "div";

  return (
    <Element
      {...(onClick ? { onClick, type: "button" as const } : {})}
      className={cx(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all duration-200 ease-calm",
        style.border,
        style.bg,
        onClick && "touchable min-h-0 active:scale-[0.97]",
        className,
      )}
    >
      <StatusDot tone={tone} pulse={pulse} />
      {icon && <span className={cx("shrink-0", style.text)}>{icon}</span>}
      <span className="min-w-0">
        <span
          className={cx(
            "block text-3xs font-medium uppercase tracking-wide2",
            style.text,
          )}
        >
          {label}
        </span>
        {detail && (
          <span className="hidden max-w-[11rem] truncate text-3xs text-zinc-600 2xl:block">
            {detail}
          </span>
        )}
      </span>
    </Element>
  );
}
