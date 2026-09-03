import { useCallback, useEffect, useRef, useState } from "react";
import { Portal } from "./Portal";
import { cx } from "@/lib/utils";

/*
 * Bildschirmtastatur für den Touchbetrieb.
 *
 * Bewusst in der App statt als Systemtastatur: Nur so lässt sich zusichern,
 * dass sie nichts verdeckt. Sie meldet ihre Höhe an `--osk-height`, und der
 * Rahmen sowie alle Overlays reservieren genau diesen Platz (siehe index.css).
 *
 * Eingaben gehen nicht über künstliche KeyboardEvents — die ignoriert React,
 * weil sie `isTrusted: false` tragen. Stattdessen wird der Wert direkt über
 * den nativen Setter gesetzt und ein echtes `input`-Event ausgelöst.
 */

type Ebene = "klein" | "gross" | "zahlen";

const REIHEN: Record<Ebene, string[][]> = {
  klein: [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["q", "w", "e", "r", "t", "z", "u", "i", "o", "p", "ü"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ö", "ä"],
    ["y", "x", "c", "v", "b", "n", "m", "ß", "-"],
  ],
  gross: [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["Q", "W", "E", "R", "T", "Z", "U", "I", "O", "P", "Ü"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ö", "Ä"],
    ["Y", "X", "C", "V", "B", "N", "M", "ß", "_"],
  ],
  zahlen: [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["@", "#", "€", "%", "&", "*", "(", ")", "/", ":"],
    ["+", "-", "=", "_", ".", ",", ";", "!", "?", "'"],
    ["https://", "www.", ".de", ".com", "~"],
  ],
};

/** Setzt den Wert so, dass React die Änderung mitbekommt. */
function schreibe(feld: HTMLInputElement | HTMLTextAreaElement, wert: string) {
  const prototyp =
    feld instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototyp, "value")?.set;
  setter?.call(feld, wert);
  feld.dispatchEvent(new Event("input", { bubbles: true }));
}

function Taste({
  label,
  onPress,
  breit,
  aktiv,
  gedaempft,
}: {
  label: string;
  onPress: () => void;
  breit?: number;
  aktiv?: boolean;
  gedaempft?: boolean;
}) {
  return (
    <button
      type="button"
      // Der Fokus muss im Textfeld bleiben, sonst weiß die Tastatur nicht mehr,
      // wohin sie schreiben soll.
      onPointerDown={(event) => {
        event.preventDefault();
        onPress();
      }}
      style={breit ? { flexGrow: breit } : undefined}
      className={cx(
        "touchable flex h-[52px] flex-1 items-center justify-center rounded-[4px]",
        "border text-[15px] font-medium transition-colors select-none",
        "active:border-accent/60 active:bg-accent/15 active:text-accent-soft",
        aktiv
          ? "border-accent/50 bg-accent/15 text-accent-soft"
          : gedaempft
            ? "border-white/[0.07] bg-white/[0.02] text-zinc-500"
            : "border-white/[0.09] bg-white/[0.04] text-zinc-200",
      )}
    >
      {label}
    </button>
  );
}

export function TouchKeyboard({ aktiv }: { aktiv: boolean }) {
  const [feld, setFeld] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [ebene, setEbene] = useState<Ebene>("gross");
  const [feststell, setFeststell] = useState(false);
  /*
   * Bewusst State statt useRef: Das Portal rendert im ersten Durchlauf null,
   * eine Ref wäre beim Messen also noch leer — die reservierte Höhe wäre dann
   * geraten statt gemessen, und die Tastatur verdeckte den Rest.
   */
  const [rahmenNode, setRahmenNode] = useState<HTMLDivElement | null>(null);
  // Zusätzlich als Ref, damit der Blur-Handler ihn ohne veralteten Abschluss liest.
  const rahmen = useRef<HTMLDivElement | null>(null);
  const merkeRahmen = useCallback((node: HTMLDivElement | null) => {
    rahmen.current = node;
    setRahmenNode(node);
  }, []);

  // Fokus verfolgen: Sobald ein Textfeld angetippt wird, geht die Tastatur auf.
  useEffect(() => {
    if (!aktiv) {
      setFeld(null);
      return;
    }

    const onFocus = (event: FocusEvent) => {
      const ziel = event.target;
      if (
        ziel instanceof HTMLInputElement &&
        !["checkbox", "radio", "range", "color", "button", "submit"].includes(ziel.type)
      ) {
        setFeld(ziel);
        setEbene(ziel.value.length === 0 ? "gross" : "klein");
      } else if (ziel instanceof HTMLTextAreaElement) {
        setFeld(ziel);
      }
    };

    const onBlur = (event: FocusEvent) => {
      // Tippen auf eine Taste nimmt den Fokus nicht weg (preventDefault oben);
      // ein echter Blur bedeutet also: Feld verlassen.
      if (rahmen.current?.contains(event.relatedTarget as Node)) return;
      setFeld(null);
    };

    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
    };
  }, [aktiv]);

  const offen = aktiv && feld !== null;

  /*
   * Höhe an das Layout melden. Der Rahmen und alle Overlays lesen
   * `--osk-height` und schrumpfen entsprechend — dadurch verdeckt die
   * Tastatur nie einen Inhalt.
   */
  useEffect(() => {
    const wurzel = document.documentElement;
    const zuruecksetzen = () => {
      wurzel.style.setProperty("--osk-height", "0px");
      document.body.classList.remove("osk-open");
    };

    if (!offen || !rahmenNode) {
      zuruecksetzen();
      return;
    }

    // Die Höhe ändert sich beim Wechsel der Ebene und bei Drehung des Panels,
    // deshalb beobachten statt einmalig messen.
    const beobachter = new ResizeObserver(() => {
      wurzel.style.setProperty("--osk-height", `${rahmenNode.offsetHeight}px`);
    });
    beobachter.observe(rahmenNode);
    wurzel.style.setProperty("--osk-height", `${rahmenNode.offsetHeight}px`);
    document.body.classList.add("osk-open");

    return () => {
      beobachter.disconnect();
      zuruecksetzen();
    };
  }, [offen, rahmenNode]);

  // Das fokussierte Feld nach dem Öffnen in den sichtbaren Bereich holen.
  useEffect(() => {
    if (!offen || !feld) return;
    const t = window.setTimeout(
      () => feld.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      260,
    );
    return () => window.clearTimeout(t);
  }, [offen, feld]);

  const tippe = useCallback(
    (zeichen: string) => {
      if (!feld) return;
      const start = feld.selectionStart ?? feld.value.length;
      const ende = feld.selectionEnd ?? feld.value.length;
      schreibe(feld, feld.value.slice(0, start) + zeichen + feld.value.slice(ende));
      const neu = start + zeichen.length;
      feld.setSelectionRange?.(neu, neu);
      if (ebene === "gross" && !feststell) setEbene("klein");
    },
    [feld, ebene, feststell],
  );

  const loesche = useCallback(() => {
    if (!feld) return;
    const start = feld.selectionStart ?? feld.value.length;
    const ende = feld.selectionEnd ?? feld.value.length;
    if (start === 0 && start === ende) return;
    const von = start === ende ? start - 1 : start;
    schreibe(feld, feld.value.slice(0, von) + feld.value.slice(ende));
    feld.setSelectionRange?.(von, von);
  }, [feld]);

  const bestaetige = useCallback(() => {
    if (!feld) return;
    if (feld instanceof HTMLTextAreaElement) {
      tippe("\n");
      return;
    }
    feld.form?.requestSubmit?.();
    feld.blur();
    setFeld(null);
  }, [feld, tippe]);

  if (!offen) return null;

  return (
    <Portal>
      <div
        ref={merkeRahmen}
        // osk-ignore: Die Tastatur selbst darf sich nicht auch noch verschieben.
        className={cx(
          "osk-ignore fixed inset-x-0 bottom-0 z-[95] select-none",
          "border-t border-white/[0.09] bg-surface-900/95 px-2 pt-2 pb-2.5",
          "shadow-[0_-18px_40px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl",
          "animate-slide-up",
        )}
      >
        <div className="mx-auto flex max-w-[1100px] flex-col gap-1.5">
          {REIHEN[ebene].map((reihe, index) => (
            <div key={index} className="flex gap-1.5">
              {index === 3 && (
                <Taste
                  label={feststell ? "⇪" : "⇧"}
                  breit={1.6}
                  aktiv={ebene === "gross"}
                  onPress={() => {
                    if (ebene === "zahlen") return setEbene("gross");
                    if (ebene === "gross" && !feststell) return setFeststell(true);
                    setFeststell(false);
                    setEbene(ebene === "gross" ? "klein" : "gross");
                  }}
                />
              )}
              {reihe.map((zeichen) => (
                <Taste key={zeichen} label={zeichen} onPress={() => tippe(zeichen)} />
              ))}
              {index === 3 && <Taste label="⌫" breit={1.6} onPress={loesche} />}
            </div>
          ))}

          <div className="flex gap-1.5">
            <Taste
              label={ebene === "zahlen" ? "ABC" : "?123"}
              breit={1.4}
              onPress={() => setEbene(ebene === "zahlen" ? "klein" : "zahlen")}
            />
            <Taste label="," onPress={() => tippe(",")} />
            <Taste label="Leertaste" breit={6} onPress={() => tippe(" ")} />
            <Taste label="." onPress={() => tippe(".")} />
            {/* Fragezeichen auf der Hauptebene: häufiger gebraucht als das @,
                das über ?123 erreichbar bleibt. */}
            <Taste label="?" onPress={() => tippe("?")} />
            <Taste label="⏎" breit={1.6} onPress={bestaetige} />
            <Taste
              label="Schließen"
              breit={1.8}
              gedaempft
              onPress={() => {
                feld?.blur();
                setFeld(null);
              }}
            />
          </div>
        </div>
      </div>
    </Portal>
  );
}
