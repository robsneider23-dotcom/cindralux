import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/utils";
import { PanelBackdrop } from "./PanelBackdrop";
import { useWindowBackdrop } from "@/hooks/useWindowBackdrop";
import type { WindowId } from "@shared/types";

interface PanelProps {
  title: string;
  /** Technischer Zusatz rechts im Kopf, z.B. "5 Termine". */
  meta?: ReactNode;
  /** Farbiger Marker links vom Titel. Ohne Angabe gilt der Theme-Akzent. */
  accent?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Inhalt scrollt intern — das Dashboard selbst scrollt nie. */
  scroll?: boolean;
  /** Macht das ganze Panel antippbar, z.B. um ein Detailfenster zu öffnen. */
  onActivate?: () => void;
  /** Beschriftung der Tipp-Aktion für Screenreader. */
  activateLabel?: string;
  /** Fenster-Kennung; der Stil kommt aus den Einstellungen. */
  backdrop?: WindowId;
}

/**
 * Gemeinsamer Rahmen mit ruhiger Flaeche und klar abgesetzter Kopfzeile.
 */
export function Panel({
  title,
  meta,
  accent,
  icon,
  children,
  className,
  bodyClassName,
  scroll = false,
  onActivate,
  activateLabel,
  backdrop,
}: PanelProps) {
  const backdropStyle = useWindowBackdrop(backdrop);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);

  // Der untere Fade darf nur erscheinen, wenn wirklich noch Inhalt folgt —
  // sonst wirkt die letzte Zeile faelschlich abgeschnitten.
  useEffect(() => {
    const element = bodyRef.current;
    if (!element || !scroll) return;

    const check = () => {
      setHasMore(
        element.scrollHeight - element.clientHeight - element.scrollTop > 6,
      );
    };

    check();
    element.addEventListener("scroll", check, { passive: true });
    const observer = new ResizeObserver(check);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);

    return () => {
      element.removeEventListener("scroll", check);
      observer.disconnect();
    };
  }, [scroll, children]);

  const marker = accent ?? "rgb(var(--accent))";

  return (
    <section
      className={cx(
        "panel flex min-h-0 flex-col",
        onActivate &&
          "cursor-pointer transition-transform duration-200 ease-calm active:scale-[0.99]",
        className,
      )}
      {...(onActivate
        ? {
            role: "button",
            tabIndex: 0,
            "aria-label": activateLabel,
            onClick: onActivate,
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActivate();
              }
            },
          }
        : {})}
    >
      {backdropStyle && <PanelBackdrop variant={backdropStyle} />}

      <header className="panel-head relative z-10">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-3.5 w-[2px] shrink-0 rounded-full"
            style={{ background: marker }}
          />
          {icon && <span className="shrink-0 text-zinc-500">{icon}</span>}
          <h2 className="label truncate text-zinc-300">{title}</h2>
        </div>
        {meta ? (
          <div className="label-dim shrink-0 whitespace-nowrap">{meta}</div>
        ) : null}
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div
          ref={bodyRef}
          className={cx(
            "min-h-0 flex-1",
            scroll && "overflow-y-auto no-scrollbar overscroll-contain",
            scroll && hasMore && "mask-fade-b",
            bodyClassName,
          )}
        >
          {children}
        </div>

        {scroll && hasMore && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
        )}
      </div>
    </section>
  );
}

/** Einheitlicher Leerzustand — nie eine nackte leere Flaeche. */
export function EmptyState({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="my-auto flex flex-col items-center gap-2.5 px-6 py-8 text-center">
      {icon && <span className="text-zinc-700">{icon}</span>}
      <p className="text-2xs uppercase tracking-wide2 text-zinc-600">{text}</p>
    </div>
  );
}

/**
 * Ladezustand. Bewusst eine eigene Anzeige: "wird geladen" darf nie wie
 * "nichts vorhanden" aussehen — beim Kiosk-Start waere das irrefuehrend.
 */
export function LoadingState({ text = "Lade …" }: { text?: string }) {
  return (
    <div className="my-auto flex flex-col items-center gap-3 px-6 py-8">
      <span className="flex gap-1.5">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent"
            style={{ animationDelay: `${dot * 180}ms` }}
          />
        ))}
      </span>
      <p className="text-2xs uppercase tracking-wide2 text-zinc-600">{text}</p>
    </div>
  );
}
