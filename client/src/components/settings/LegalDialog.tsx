import { X } from "lucide-react";
import { useEffect } from "react";
import { Portal } from "../Portal";

interface Props {
  title: string;
  paragraphs: string[];
  onClose: () => void;
}

/**
 * Schlichtes Textfenster für Datenschutz und Haftungsausschluss.
 *
 * Kein eigenes Formular, keine Aktion außer Schließen — deshalb bewusst
 * schlanker als die übrigen Dialoge (z. B. AddGoogleCalendarDialog).
 */
export function LegalDialog({ title, paragraphs, onClose }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
        <div className="panel scanlines noise flex max-h-full w-full max-w-xl flex-col bg-surface-800">
          <header className="panel-head">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-3.5 w-[2px] shrink-0 rounded-full"
                style={{
                  background: "rgb(var(--accent))",
                  boxShadow: "0 0 10px rgb(var(--accent))",
                }}
              />
              <h2 className="label text-zinc-300">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="touchable flex h-[46px] w-[46px] min-h-0 items-center justify-center rounded-[3px] border border-white/[0.09] text-zinc-400 active:border-accent/50 active:text-accent-soft"
            >
              <X size={20} strokeWidth={1.8} />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-6">
            {paragraphs.map((absatz, index) => (
              <p key={index} className="text-2xs leading-relaxed text-zinc-400">
                {absatz}
              </p>
            ))}
          </div>

          <footer className="flex shrink-0 justify-end border-t border-white/[0.055] p-3">
            <button
              type="button"
              onClick={onClose}
              className="btn min-h-[50px] px-5"
            >
              Verstanden
            </button>
          </footer>
        </div>
      </div>
    </Portal>
  );
}
