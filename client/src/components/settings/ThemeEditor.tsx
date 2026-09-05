import { Check, Palette } from "lucide-react";
import type { FontPairingId, ThemeMode } from "@shared/types";
import { accents, fontPairings, themeLabels, themePresets } from "@/theme/tokens.js";
import { deriveAccentShades } from "@/lib/utils";
import { cx } from "@/lib/utils";
import { Field } from "./SettingsControls";

interface Props {
  themeMode: ThemeMode;
  customAccent: string;
  fontPairing: FontPairingId;
  onChange: (
    patch: Partial<{
      themeMode: ThemeMode;
      customAccent: string;
      fontPairing: FontPairingId;
    }>,
  ) => void;
}

/** Vier Punkte in den Abstufungen einer Palette — kleine Farbprobe je Kachel. */
function Probe({ palette }: { palette: { base: string; soft: string; hot: string; dim: string } }) {
  return (
    <span className="flex gap-1" aria-hidden>
      {[palette.dim, palette.hot, palette.base, palette.soft].map((farbe, index) => (
        <span
          key={index}
          className="h-3.5 w-3.5 rounded-full"
          style={{ background: farbe }}
        />
      ))}
    </span>
  );
}

const NAMED_THEMES = Object.keys(themeLabels) as Exclude<ThemeMode, "custom">[];

/**
 * Design: fuenf fertige Vorlagen (Farbe + Schrift in einem Tipp), plus separat
 * Akzentfarbe und Schriftart einzeln waehlbar — genau das gleiche Muster wie
 * bei der Anordnung (LayoutEditor.tsx): Kachel-Vorschlaege oben, feine
 * Kontrolle darunter, beides schreibt in dieselben Felder.
 */
export function ThemeEditor({ themeMode, customAccent, fontPairing, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <span className="label mb-2.5 block text-zinc-500">Design-Vorlagen</span>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
          {themePresets.map((preset) => {
            const palette = accents[preset.id];
            const aktiv = themeMode === preset.id && fontPairing === preset.fontPairing;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onChange({
                    themeMode: preset.id as ThemeMode,
                    fontPairing: preset.fontPairing as FontPairingId,
                  })
                }
                className={cx(
                  "touchable flex flex-col items-start gap-2 rounded-[3px] border px-3.5 py-3 text-left",
                  aktiv
                    ? "border-accent/50 bg-accent/[0.1] shadow-glow"
                    : "border-white/[0.08] bg-white/[0.02]",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <Probe palette={palette} />
                  {aktiv && <Check size={14} strokeWidth={2.4} className="text-accent-soft" />}
                </div>
                <span className="text-2xs uppercase tracking-wide2 text-zinc-300">
                  {preset.label}
                </span>
                <span
                  className="text-3xs leading-relaxed text-zinc-500"
                  style={{ fontFamily: fontPairings[preset.fontPairing].sans }}
                >
                  {preset.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="label mb-2.5 block text-zinc-500">Akzentfarbe einzeln</span>
        <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-5">
          {NAMED_THEMES.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ themeMode: id })}
              className={cx(
                "touchable flex flex-col items-center gap-2 rounded-[3px] border px-2 py-3",
                themeMode === id
                  ? "border-accent/50 bg-accent/[0.1]"
                  : "border-white/[0.08] bg-white/[0.02]",
              )}
            >
              <Probe palette={accents[id]} />
              <span className="text-3xs uppercase tracking-wide2 text-zinc-400">
                {themeLabels[id]}
              </span>
            </button>
          ))}

          <label
            className={cx(
              "touchable relative flex flex-col items-center gap-2 rounded-[3px] border px-2 py-3",
              themeMode === "custom"
                ? "border-accent/50 bg-accent/[0.1]"
                : "border-white/[0.08] bg-white/[0.02]",
            )}
          >
            <input
              type="color"
              value={customAccent}
              onChange={(event) =>
                onChange({ themeMode: "custom", customAccent: event.target.value })
              }
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <Probe palette={deriveAccentShades(customAccent)} />
            <span className="flex items-center gap-1 text-3xs uppercase tracking-wide2 text-zinc-400">
              <Palette size={11} strokeWidth={1.8} />
              Eigene
            </span>
          </label>
        </div>
      </div>

      <div>
        <span className="label mb-2.5 block text-zinc-500">Schriftart</span>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
          {(Object.keys(fontPairings) as FontPairingId[]).map((id) => {
            const schrift = fontPairings[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ fontPairing: id })}
                className={cx(
                  "touchable flex flex-col items-start gap-1.5 rounded-[3px] border px-3.5 py-3 text-left",
                  fontPairing === id
                    ? "border-accent/50 bg-accent/[0.1]"
                    : "border-white/[0.08] bg-white/[0.02]",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className="text-sm text-zinc-200"
                    style={{ fontFamily: schrift.sans }}
                  >
                    Aa Bb 12:34
                  </span>
                  {fontPairing === id && (
                    <Check size={14} strokeWidth={2.4} className="text-accent-soft" />
                  )}
                </div>
                <span className="text-2xs uppercase tracking-wide2 text-zinc-300">
                  {schrift.label}
                </span>
                <span className="text-3xs leading-relaxed text-zinc-500">{schrift.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {themeMode === "custom" && (
        <div className="max-w-xs">
          <Field label="Eigene Akzentfarbe (Hex)">
            <input
              value={customAccent}
              onChange={(event) => onChange({ customAccent: event.target.value })}
              placeholder="#7c9eff"
              spellCheck={false}
              autoCapitalize="off"
              className="field font-mono text-2xs"
            />
          </Field>
        </div>
      )}
    </div>
  );
}
