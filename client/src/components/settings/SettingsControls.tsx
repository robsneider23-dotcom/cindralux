import { Check, Loader2, Plug, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { TestResult } from "@/lib/api";
import { cx } from "@/lib/utils";

/** Beschriftetes Feld mit optionaler Erklärung darunter. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label mb-2 block">{label}</span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-3xs leading-relaxed text-zinc-600">
          {hint}
        </span>
      )}
    </label>
  );
}

export function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="mb-7">
      <div className="mb-3.5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
          {description && (
            <p className="mt-1 text-3xs leading-relaxed text-zinc-600">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Reiner Schalter ohne Beschriftung — fuer Tabellen- und Zeilen-Layouts. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "touchable flex h-[46px] w-[62px] min-h-0 shrink-0 items-center justify-center rounded-[3px] border",
        checked
          ? "border-accent/40 bg-accent/[0.1]"
          : "border-white/[0.08] bg-white/[0.02]",
      )}
    >
      <span
        className={cx(
          "flex h-7 w-12 items-center rounded-full border px-[3px] transition-all duration-300 ease-calm",
          checked
            ? "justify-end border-accent/60 bg-accent/25"
            : "justify-start border-white/10 bg-black/40",
        )}
      >
        <span
          className={cx(
            "block h-[21px] w-[21px] rounded-full transition-colors duration-300",
            checked ? "bg-accent shadow-glow" : "bg-zinc-600",
          )}
        />
      </span>
    </button>
  );
}

/** Großer Schalter für Ja/Nein-Einstellungen. */
export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="touchable flex w-full items-center gap-4 rounded-[3px] border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left active:border-accent/40"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-zinc-200">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-3xs text-zinc-600">{hint}</span>
        )}
      </span>
      <span
        className={cx(
          "flex h-7 w-12 shrink-0 items-center rounded-full border px-[3px] transition-all duration-300 ease-calm",
          checked
            ? "justify-end border-accent/60 bg-accent/25"
            : "justify-start border-white/10 bg-black/40",
        )}
      >
        <span
          className={cx(
            "block h-[21px] w-[21px] rounded-full transition-colors duration-300",
            checked ? "bg-accent shadow-glow" : "bg-zinc-600",
          )}
        />
      </span>
    </button>
  );
}

/** Auswahl aus wenigen Optionen als große Segmente statt Dropdown. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cx(
            "touchable flex-1 rounded-[3px] border px-3 text-2xs uppercase tracking-wide2",
            value === option.value
              ? "border-accent/50 bg-accent/15 text-accent-soft"
              : "border-white/[0.08] bg-white/[0.02] text-zinc-400",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Verbindungstest mit Zustandsanzeige direkt am Button. */
export function TestButton({
  label,
  run,
}: {
  label: string;
  run: () => Promise<TestResult>;
}) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "fail">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const execute = async () => {
    setState("busy");
    setMessage(null);
    try {
      const result = await run();
      setState(result.ok ? "ok" : "fail");
      setMessage(result.message);
    } catch (error) {
      setState("fail");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <button
        type="button"
        onClick={execute}
        disabled={state === "busy"}
        className={cx(
          "btn min-h-[48px]",
          state === "ok" &&
            "border-signal-ok/40 bg-signal-ok/10 text-signal-ok",
          state === "fail" &&
            "border-signal-err/40 bg-signal-err/10 text-signal-err",
        )}
      >
        {state === "busy" && (
          <Loader2 size={15} strokeWidth={1.8} className="animate-spin" />
        )}
        {state === "ok" && <Check size={15} strokeWidth={2} />}
        {state === "fail" && <X size={15} strokeWidth={2} />}
        {state === "idle" && <Plug size={15} strokeWidth={1.8} />}
        {label}
      </button>
      {message && (
        <p
          className={cx(
            "text-3xs leading-relaxed",
            state === "ok" ? "text-signal-ok/80" : "text-signal-err/80",
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}

/** Farbwähler aus der Kalenderpalette — große, gut treffbare Punkte. */
export function ColorPicker({
  value,
  palette,
  onChange,
}: {
  value: string;
  palette: string[];
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {palette.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={`Farbe ${color}`}
          className={cx(
            "h-11 w-11 rounded-[3px] border-2 transition-all duration-200 ease-calm active:scale-90",
            value.toLowerCase() === color.toLowerCase()
              ? "border-white/70"
              : "border-white/10 opacity-75",
          )}
          style={{ background: color, boxShadow: `0 0 16px -4px ${color}` }}
        />
      ))}
    </div>
  );
}
