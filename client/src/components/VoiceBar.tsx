import { AlertTriangle, Radio, Square, Volume2 } from "lucide-react";
import type { RealtimeVoice } from "@/hooks/useRealtimeVoice";
import { cx } from "@/lib/utils";

/**
 * Zustandsleiste des Sprachmodus. Sie erscheint nur, wenn eine Sitzung läuft,
 * verbindet oder fehlgeschlagen ist — im Ruhezustand nimmt sie keinen Platz weg.
 */
export function VoiceBar({ voice }: { voice: RealtimeVoice }) {
  if (voice.status === "idle") return null;

  if (voice.status === "error") {
    return (
      <div className="mx-2.5 mb-2 flex items-start gap-2.5 rounded-[3px] border border-signal-err/30 bg-signal-err/[0.08] px-3 py-2.5">
        <AlertTriangle
          size={14}
          strokeWidth={1.8}
          className="mt-px shrink-0 text-signal-err"
        />
        <p className="min-w-0 flex-1 text-3xs leading-relaxed text-signal-err/90">
          {voice.error}
        </p>
      </div>
    );
  }

  const connecting = voice.status === "connecting";

  return (
    <div
      className={cx(
        "mx-2.5 mb-2 flex items-center gap-3 rounded-[3px] border px-3 py-2.5 transition-colors duration-300",
        voice.speaking
          ? "border-accent/45 bg-accent/[0.12]"
          : voice.listening
            ? "border-signal-ok/40 bg-signal-ok/[0.09]"
            : "border-white/[0.09] bg-white/[0.025]",
      )}
    >
      {/* Pegelanzeige — reagiert auf Sprechen und Antworten */}
      <span className="flex shrink-0 items-end gap-[3px]" aria-hidden>
        {[0, 1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={cx(
              "w-[3px] rounded-full transition-all duration-300 ease-calm",
              voice.speaking
                ? "bg-accent animate-pulse-soft"
                : voice.listening
                  ? "bg-signal-ok animate-pulse-soft"
                  : "bg-zinc-700",
            )}
            style={{
              height:
                voice.speaking || voice.listening ? 6 + ((bar * 5) % 13) : 4,
              animationDelay: `${bar * 110}ms`,
            }}
          />
        ))}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-3xs font-medium uppercase tracking-wide2 text-zinc-300">
          {connecting ? (
            <>
              <Radio size={11} strokeWidth={2} className="animate-pulse-soft" />
              Verbinde …
            </>
          ) : voice.speaking ? (
            <>
              <Volume2 size={11} strokeWidth={2} className="text-accent" />
              Antwortet
            </>
          ) : voice.listening ? (
            <>
              <Radio size={11} strokeWidth={2} className="text-signal-ok" />
              Hört zu
            </>
          ) : (
            <>
              <Radio size={11} strokeWidth={2} className="text-zinc-500" />
              Bereit — sprich einfach
            </>
          )}
        </span>
      </span>

      {voice.speaking && (
        <button
          type="button"
          onClick={voice.interrupt}
          className="touchable flex h-9 min-h-0 shrink-0 items-center gap-1.5 rounded-[3px] border border-white/[0.1] px-2.5 text-3xs uppercase tracking-wide2 text-zinc-400 active:border-accent/50 active:text-accent-soft"
        >
          <Square size={10} strokeWidth={2.4} />
          Stopp
        </button>
      )}
    </div>
  );
}
