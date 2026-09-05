import { Check, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PhotoItem } from "@shared/types";
import { Portal } from "../Portal";

interface Props {
  photo: PhotoItem;
  onCancel: () => void;
  onSave: (focus: { x: number; y: number } | null) => void;
}

/**
 * Bildausschnitt-Rahmen: zeigt das ganze Foto, darüber ein verschiebbarer
 * Rahmen im tatsächlichen Seitenverhältnis des Bildschirms (nicht fest 16:9 —
 * das Panel läuft auf sehr unterschiedlichen Formaten, von 1024×600 bis
 * 1920×1080). Was im Rahmen liegt, ist genau das, was die Diashow später mit
 * `object-fit: cover` zeigt.
 *
 * Rechnung wie bei CSS `cover`: eine der beiden Bildseiten füllt den Rahmen
 * immer ganz aus, verschieben lässt sich nur entlang der anderen Achse — ein
 * hochformatiges Rahmenmotiv in einem breiten Bild etwa nur nach links/rechts,
 * nicht hoch/runter, weil da schon alles sichtbar ist.
 */
export function FocusPointEditor({ photo, onCancel, onSave }: Props) {
  const [focus, setFocus] = useState(photo.focus ?? { x: 50, y: 50 });
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  /*
   * Der Touchscreen meldet sich als zwei Eingabegeräte gleichzeitig (Touch
   * UND Maus, siehe deploy/cindralux-kiosk.sh) — ein einzelner Fingertipp
   * kann dadurch zwei ueberlappende Zeiger-Stroeme mit je eigener pointerId
   * ausloesen. Ohne die pointerId im State wuerde der zweite, meist leicht
   * versetzte Strom mitten in der Bewegung uebernehmen und den Rahmen
   * springen lassen. Deshalb: nach dem ersten pointerdown zaehlt nur noch
   * genau diese pointerId, bis sie wieder losgelassen wird.
   */
  const dragState = useRef<{ pointerId: number; rect: DOMRect; frameW: number; frameH: number } | null>(
    null,
  );

  // Seitenverhältnis des Bildschirms, auf dem gerade eingerichtet wird — das
  // ist der ehrlichste verfügbare Wert für "was im Screensaver gezeigt wird".
  const targetAspect = window.innerWidth / window.innerHeight;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const frameSize = (rect: DOMRect) => {
    const imgAspect = rect.width / rect.height;
    return imgAspect > targetAspect
      ? { w: rect.height * targetAspect, h: rect.height }
      : { w: rect.width, h: rect.width / targetAspect };
  };

  const applyPointer = (clientX: number, clientY: number) => {
    const state = dragState.current;
    if (!state) return;
    const { rect, frameW, frameH } = state;
    const centerX = Math.min(Math.max(clientX - rect.left, frameW / 2), rect.width - frameW / 2);
    const centerY = Math.min(Math.max(clientY - rect.top, frameH / 2), rect.height - frameH / 2);
    setFocus({
      x: (centerX / rect.width) * 100,
      y: (centerY / rect.height) * 100,
    });
  };

  const startDrag = (event: React.PointerEvent) => {
    // Ein Zeiger reicht — ein zweiter (typischerweise der Maus-Zwilling
    // desselben Fingertipps) darf eine laufende Bewegung nicht kapern.
    if (dragState.current) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const { w, h } = frameSize(rect);
    dragState.current = { pointerId: event.pointerId, rect, frameW: w, frameH: h };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    applyPointer(event.clientX, event.clientY);
  };

  const duringDrag = (event: React.PointerEvent) => {
    if (!dragState.current || event.pointerId !== dragState.current.pointerId) return;
    applyPointer(event.clientX, event.clientY);
  };

  const endDrag = (event: React.PointerEvent) => {
    if (dragState.current && event.pointerId !== dragState.current.pointerId) return;
    dragState.current = null;
  };

  // Rahmenmaße in Prozent der Anzeige — für das Overlay, unabhängig von der
  // tatsächlichen Pixelgröße (die kennt der Browser erst nach dem Laden).
  const rect = imgRef.current?.getBoundingClientRect();
  const frame =
    rect && naturalAspect !== null
      ? (() => {
          const { w, h } = frameSize(rect);
          const centerX = (focus.x / 100) * rect.width;
          const centerY = (focus.y / 100) * rect.height;
          const left = Math.min(Math.max(centerX - w / 2, 0), rect.width - w);
          const top = Math.min(Math.max(centerY - h / 2, 0), rect.height - h);
          return {
            left: (left / rect.width) * 100,
            top: (top / rect.height) * 100,
            width: (w / rect.width) * 100,
            height: (h / rect.height) * 100,
          };
        })()
      : null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
        <div className="panel scanlines noise flex max-h-full w-full max-w-3xl flex-col bg-surface-800">
          <header className="panel-head">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-3.5 w-[2px] shrink-0 rounded-full"
                style={{ background: "rgb(var(--accent))", boxShadow: "0 0 10px rgb(var(--accent))" }}
              />
              <h2 className="label truncate text-zinc-300">Bildausschnitt — {photo.name}</h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Abbrechen"
              className="touchable flex h-[46px] w-[46px] min-h-0 items-center justify-center rounded-[3px] border border-white/[0.09] text-zinc-400 active:border-accent/50 active:text-accent-soft"
            >
              <X size={20} strokeWidth={1.8} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <p className="mb-3 text-3xs leading-relaxed text-zinc-500">
              Den hellen Rahmen verschieben — er zeigt genau den Ausschnitt, den die
              Diashow auf diesem Bildschirm später anzeigt (Seitenverhältnis{" "}
              {targetAspect.toFixed(2)}:1).
            </p>

            {/*
              `w-fit` lässt den Rahmen exakt an der tatsächlich sichtbaren
              Bildfläche kleben, ohne Letterboxing: Die Bildgröße selbst kommt
              über max-width/max-height plus auto/auto zustande (der Browser
              berechnet die größte Darstellung, die das Seitenverhältnis
              erhält) — object-contain bräuchte sonst einen Container mit
              eigenem, abweichendem Seitenverhältnis, und genau dessen
              Letterbox-Ränder würden die Rahmen-Prozentrechnung verfälschen.
            */}
            <div className="relative mx-auto w-fit touch-none select-none overflow-hidden rounded-[3px] bg-black">
              <img
                ref={imgRef}
                src={photo.url}
                alt=""
                draggable={false}
                onLoad={(event) => {
                  const el = event.currentTarget;
                  setNaturalAspect(el.naturalWidth / el.naturalHeight);
                }}
                className="block h-auto max-h-[60vh] w-auto max-w-full"
              />

              {frame && (
                <div
                  role="slider"
                  aria-label="Bildausschnitt verschieben"
                  aria-valuenow={Math.round(focus.x)}
                  onPointerDown={startDrag}
                  onPointerMove={duringDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  className="absolute cursor-move touch-none border-2 border-white shadow-[0_0_0_1000px_rgba(0,0,0,0.55)]"
                  style={{
                    left: `${frame.left}%`,
                    top: `${frame.top}%`,
                    width: `${frame.width}%`,
                    height: `${frame.height}%`,
                  }}
                >
                  <span className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80" />
                </div>
              )}
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-white/[0.055] p-3">
            <button
              type="button"
              onClick={() => setFocus({ x: 50, y: 50 })}
              className="btn min-h-[50px] px-4"
            >
              <RotateCcw size={14} strokeWidth={1.8} />
              Mitte
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onCancel} className="btn min-h-[50px] px-5">
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => onSave(focus.x === 50 && focus.y === 50 ? null : focus)}
                className="btn btn-accent min-h-[50px] px-6"
              >
                <Check size={16} strokeWidth={2.2} />
                Übernehmen
              </button>
            </div>
          </footer>
        </div>
      </div>
    </Portal>
  );
}
