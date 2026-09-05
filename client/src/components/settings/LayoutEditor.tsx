import { ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import type { DashboardPanelId, LayoutColumn, LayoutConfig } from "@shared/types";
import { LAYOUT_PRESETS, presetColumns } from "@/lib/layouts";
import { PANEL_DEFINITIONS } from "../dashboard/panelRegistry";
import { cx } from "@/lib/utils";
import { Field, SegmentedControl } from "./SettingsControls";

/**
 * Anordnung des Dashboards: zehn Vorlagen oder eine eigene.
 *
 * Der eigene Modus kommt bewusst ohne Ziehen und Ablegen aus. Auf einem
 * Touchpanel im Flur ist Drag & Drop mit fettigen Fingern eine Zumutung —
 * jedes Panel bekommt stattdessen eine Spaltenwahl (oder „aus") und zwei
 * Pfeile für die Reihenfolge. Damit ist jede Anordnung in Einzeltipps
 * erreichbar, und nichts kann versehentlich irgendwo fallen gelassen werden.
 *
 * Die Spaltensumme bleibt immer 12: Wer eine Spalte breiter macht, nimmt die
 * Breite automatisch der breitesten anderen weg. So kann kein ungültiges
 * Raster entstehen, das man erst wieder geradebiegen müsste.
 */

const MAX_SPALTEN = 4;

/** Kleine Vorschau: Spaltenbreiten als Balken, Panels als Kästchen darin. */
function Vorschau({ columns }: { columns: LayoutColumn[] }) {
  return (
    <span className="flex h-11 w-full gap-[3px]" aria-hidden>
      {columns.map((spalte, index) => (
        <span
          key={index}
          className="flex flex-col gap-[3px] rounded-[2px] bg-white/[0.05]"
          style={{ flexGrow: spalte.span, flexBasis: 0 }}
        >
          {spalte.panels.map((panel, reihe) => (
            <span
              key={panel}
              className={cx(
                "flex-1 rounded-[2px]",
                reihe === 0 ? "bg-accent/45" : "bg-white/20",
              )}
            />
          ))}
        </span>
      ))}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Reine Umformungen der Spaltenliste                                          */
/* -------------------------------------------------------------------------- */

/** Breiten so verteilen, dass die Summe wieder 12 ergibt. */
function normalisiere(columns: LayoutColumn[]): LayoutColumn[] {
  if (columns.length === 0) return columns;
  const kopie = columns.map((spalte) => ({ ...spalte, span: Math.max(1, spalte.span) }));
  let summe = kopie.reduce((wert, spalte) => wert + spalte.span, 0);

  // Zu breit: der breitesten Spalte wegnehmen, bis es passt. Zu schmal:
  // der schmalsten geben. Beides laesst die Verhaeltnisse am ehesten intakt.
  while (summe > 12) {
    const breiteste = kopie.reduce((a, b) => (b.span > a.span ? b : a));
    if (breiteste.span <= 1) break;
    breiteste.span -= 1;
    summe -= 1;
  }
  while (summe < 12) {
    const schmalste = kopie.reduce((a, b) => (b.span < a.span ? b : a));
    schmalste.span += 1;
    summe += 1;
  }
  return kopie;
}

function spaltenAnzahlSetzen(columns: LayoutColumn[], anzahl: number): LayoutColumn[] {
  if (anzahl === columns.length) return columns;

  if (anzahl < columns.length) {
    const bleibt = columns.slice(0, anzahl);
    // Panels der entfallenden Spalten gehen nicht verloren, sie ruecken in
    // die letzte verbleibende — Abwaehlen soll eine bewusste Geste sein.
    const heimatlos = columns.slice(anzahl).flatMap((spalte) => spalte.panels);
    const letzte = bleibt[bleibt.length - 1];
    if (letzte) letzte.panels = [...letzte.panels, ...heimatlos];
    return normalisiere(bleibt.map((spalte) => ({ ...spalte })));
  }

  const ergaenzt = [...columns.map((spalte) => ({ ...spalte }))];
  while (ergaenzt.length < anzahl) ergaenzt.push({ span: 1, panels: [] });
  return normalisiere(ergaenzt);
}

function breiteAendern(
  columns: LayoutColumn[],
  index: number,
  delta: number,
): LayoutColumn[] {
  const kopie = columns.map((spalte) => ({ ...spalte }));
  const ziel = kopie[index];
  if (!ziel) return columns;

  const neu = ziel.span + delta;
  if (neu < 1 || neu > 12 - (kopie.length - 1)) return columns;

  // Die Gegenspalte: beim Verbreitern die breiteste andere (die verkraftet
  // es am ehesten), beim Schmalermachen ebenfalls die breiteste — dort faellt
  // ein Pixel mehr am wenigsten auf.
  const andere = kopie.filter((_, i) => i !== index);
  if (andere.length === 0) return columns;
  const gegen = andere.reduce((a, b) => (b.span > a.span ? b : a));
  if (delta > 0 && gegen.span <= 1) return columns;

  ziel.span = neu;
  gegen.span -= delta;
  return kopie;
}

function panelSpalte(columns: LayoutColumn[], panel: DashboardPanelId): number | null {
  const index = columns.findIndex((spalte) => spalte.panels.includes(panel));
  return index === -1 ? null : index;
}

function panelVerschieben(
  columns: LayoutColumn[],
  panel: DashboardPanelId,
  zielSpalte: number | null,
): LayoutColumn[] {
  const ohne = columns.map((spalte) => ({
    ...spalte,
    panels: spalte.panels.filter((eintrag) => eintrag !== panel),
  }));
  if (zielSpalte === null) return ohne;
  const ziel = ohne[zielSpalte];
  if (!ziel) return ohne;
  ziel.panels = [...ziel.panels, panel];
  return ohne;
}

function panelSchieben(
  columns: LayoutColumn[],
  panel: DashboardPanelId,
  richtung: -1 | 1,
): LayoutColumn[] {
  const spalteIndex = panelSpalte(columns, panel);
  if (spalteIndex === null) return columns;

  const kopie = columns.map((spalte) => ({ ...spalte, panels: [...spalte.panels] }));
  const liste = kopie[spalteIndex]!.panels;
  const von = liste.indexOf(panel);
  const nach = von + richtung;
  if (nach < 0 || nach >= liste.length) return columns;

  [liste[von], liste[nach]] = [liste[nach]!, liste[von]!];
  return kopie;
}

/* -------------------------------------------------------------------------- */

export function LayoutEditor({
  layout,
  onChange,
}: {
  layout: LayoutConfig;
  onChange: (next: LayoutConfig) => void;
}) {
  const eigene = layout.preset === "custom";
  const spalten = eigene ? layout.custom : presetColumns(layout.preset);

  /*
   * Was hinter "Eigene" steckt — Vorschau und Klick müssen dasselbe liefern.
   *
   * Eine früher gebaute eigene Anordnung bleibt erhalten, auch wenn
   * zwischendurch eine Vorlage aktiv war: Handarbeit wirft man nicht weg,
   * bloß weil jemand eine Vorlage ausprobiert hat. Nur wenn es noch keine
   * gibt, dient die gerade gezeigte Vorlage als Ausgangspunkt.
   */
  const eigeneSpalten =
    layout.custom.length > 0 ? layout.custom : presetColumns(layout.preset);

  const setzeSpalten = (columns: LayoutColumn[]) =>
    onChange({ ...layout, preset: "custom", custom: columns });

  return (
    <>
      <p className="label mb-2.5">Vorlage</p>
      <div className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-3">
        {LAYOUT_PRESETS.map((vorlage) => {
          const aktiv = layout.preset === vorlage.id;
          return (
            <button
              key={vorlage.id}
              type="button"
              onClick={() => onChange({ ...layout, preset: vorlage.id })}
              className={cx(
                "touchable flex flex-col gap-2 rounded-[3px] border p-2.5 text-left",
                aktiv
                  ? "border-accent/50 bg-accent/[0.08]"
                  : "border-white/[0.08] active:bg-white/[0.035]",
              )}
            >
              <Vorschau columns={vorlage.columns} />
              <span
                className={cx(
                  "text-2xs font-medium",
                  aktiv ? "text-accent-soft" : "text-zinc-300",
                )}
              >
                {vorlage.label}
              </span>
              <span className="line-clamp-2 text-3xs leading-relaxed text-zinc-600">
                {vorlage.hint}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onChange({ ...layout, preset: "custom", custom: eigeneSpalten })}
          className={cx(
            "touchable flex flex-col gap-2 rounded-[3px] border p-2.5 text-left",
            eigene
              ? "border-accent/50 bg-accent/[0.08]"
              : "border-white/[0.08] active:bg-white/[0.035]",
          )}
        >
          <Vorschau columns={eigeneSpalten} />
          <span
            className={cx(
              "text-2xs font-medium",
              eigene ? "text-accent-soft" : "text-zinc-300",
            )}
          >
            Eigene
          </span>
          <span className="line-clamp-2 text-3xs leading-relaxed text-zinc-600">
            Selbst festlegen, was zu sehen ist und wo es steht.
          </span>
        </button>
      </div>

      {eigene && (
        <div className="rounded-[3px] border border-white/[0.07] bg-white/[0.012] p-3.5">
          <Field
            label="Spalten"
            hint="Panels aus entfallenden Spalten rücken in die letzte, sie gehen nicht verloren."
          >
            <SegmentedControl<string>
              value={String(spalten.length)}
              onChange={(wert) => setzeSpalten(spaltenAnzahlSetzen(spalten, Number(wert)))}
              options={Array.from({ length: MAX_SPALTEN }, (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
              }))}
            />
          </Field>

          <p className="label mb-2.5 mt-5">Breiten</p>
          <div className="mb-5 flex flex-wrap gap-2">
            {spalten.map((spalte, index) => (
              <div
                key={index}
                className="flex items-center gap-1.5 rounded-[3px] border border-white/[0.08] px-2 py-1.5"
              >
                <span className="text-3xs uppercase tracking-wide2 text-zinc-500">
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setzeSpalten(breiteAendern(spalten, index, -1))}
                  className="touchable flex h-9 w-9 items-center justify-center rounded-[2px] border border-white/[0.08]"
                  aria-label={`Spalte ${index + 1} schmaler`}
                >
                  <Minus size={14} strokeWidth={2} />
                </button>
                <span className="digits w-6 text-center text-sm text-zinc-200">
                  {spalte.span}
                </span>
                <button
                  type="button"
                  onClick={() => setzeSpalten(breiteAendern(spalten, index, 1))}
                  className="touchable flex h-9 w-9 items-center justify-center rounded-[2px] border border-white/[0.08]"
                  aria-label={`Spalte ${index + 1} breiter`}
                >
                  <Plus size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>

          <p className="label mb-2.5">Panels</p>
          <div className="space-y-1.5">
            {PANEL_DEFINITIONS.map((panel) => {
              const spalteIndex = panelSpalte(spalten, panel.id);
              const sichtbar = spalteIndex !== null;
              return (
                <div
                  key={panel.id}
                  className={cx(
                    "flex flex-wrap items-center gap-2 rounded-[3px] border px-3 py-2",
                    sichtbar
                      ? "border-white/[0.09] bg-white/[0.02]"
                      : "border-white/[0.05] opacity-50",
                  )}
                >
                  <span className="flex min-w-[9rem] items-center gap-2 text-zinc-300">
                    <span className="shrink-0 text-zinc-500">{panel.icon}</span>
                    <span className="truncate text-2xs">{panel.label}</span>
                  </span>

                  <div className="ml-auto flex items-center gap-2">
                    <SegmentedControl<string>
                      value={sichtbar ? String(spalteIndex) : "aus"}
                      onChange={(wert) =>
                        setzeSpalten(
                          panelVerschieben(
                            spalten,
                            panel.id,
                            wert === "aus" ? null : Number(wert),
                          ),
                        )
                      }
                      options={[
                        { value: "aus", label: "Aus" },
                        ...spalten.map((_, index) => ({
                          value: String(index),
                          label: String(index + 1),
                        })),
                      ]}
                    />

                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={!sichtbar}
                        onClick={() => setzeSpalten(panelSchieben(spalten, panel.id, -1))}
                        className="touchable flex h-9 w-9 items-center justify-center rounded-[2px] border border-white/[0.08] disabled:opacity-30"
                        aria-label={`${panel.label} nach oben`}
                      >
                        <ChevronUp size={14} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        disabled={!sichtbar}
                        onClick={() => setzeSpalten(panelSchieben(spalten, panel.id, 1))}
                        className="touchable flex h-9 w-9 items-center justify-center rounded-[2px] border border-white/[0.08] disabled:opacity-30"
                        aria-label={`${panel.label} nach unten`}
                      >
                        <ChevronDown size={14} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-3xs leading-relaxed text-zinc-600">
            Abgewählte Panels sind nicht verschwunden — Smart Home, Messwerte,
            Assistent und Liste öffnen sich weiterhin über die Startleiste.
          </p>
        </div>
      )}
    </>
  );
}
