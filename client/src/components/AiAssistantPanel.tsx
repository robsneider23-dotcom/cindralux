import {
  CalendarClock,
  House,
  Loader2,
  Mic,
  PhoneOff,
  Send,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AiMessage, AiMode, HomeAssistantAction } from "@shared/types";
import { api } from "@/lib/api";
import { useDashboard } from "@/lib/store";
import { useTimers } from "@/lib/timersStore";
import { cx } from "@/lib/utils";
import { useRealtimeVoice, type ToolExecutor } from "@/hooks/useRealtimeVoice";
import { Panel } from "./Panel";
import { GptLiveView } from "./ai/GptLiveView";
import { VoiceBar } from "./VoiceBar";

interface Entry extends AiMessage {
  id: string;
  mode?: "live" | "mock";
  error?: string;
  /** Über den Sprachmodus entstanden. */
  spoken?: boolean;
  /** Transkript wächst noch. */
  partial?: boolean;
}

const QUICK_ACTIONS = [
  { id: "briefing", label: "Briefing", title: "Tagesbriefing", icon: Sun },
  {
    id: "agenda",
    label: "Heute",
    title: "Was steht heute an?",
    icon: CalendarClock,
  },
  {
    id: "smarthome",
    label: "Smart Home",
    title: "Smart Home Vorschlag",
    icon: House,
  },
] as const;

let entryId = 0;
const nextId = () => `entry-${(entryId += 1)}`;

/** Normalisiert gesprochene und konfigurierte Namen für den Abgleich. */
function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9äöüß ]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Alle erkannten Namen einer Kachel: Label, Zusatz, ID und Entity ohne Domain. */
function actionAliases(action: HomeAssistantAction): string[] {
  const entityName =
    action.entityId && action.entityId !== "all"
      ? (action.entityId.split(".").pop()?.replace(/_/g, " ") ?? "")
      : "";

  return [action.label, action.hint ?? "", action.id.replace(/-/g, " "), entityName]
    .map(normalizeName)
    .filter(Boolean);
}

/**
 * Findet die Kachel zu einem gesprochenen Namen. Zuerst exakte Treffer auf
 * Label, ID und Entity — dann Teiltreffer in beide Richtungen, damit auch
 * „Kueche" oder „das Licht im Wohnzimmer" ankommt.
 */
function resolveSmartHomeAction(
  actions: HomeAssistantAction[],
  wanted: string,
): HomeAssistantAction | undefined {
  const target = normalizeName(wanted);
  if (!target) return undefined;

  for (const action of actions) {
    if (actionAliases(action).some((alias) => alias === target)) return action;
  }

  let best: HomeAssistantAction | undefined;
  let bestScore = 0;
  for (const action of actions) {
    for (const alias of actionAliases(action)) {
      const score =
        target.includes(alias) || alias.includes(target) ? Math.min(target.length, alias.length) : 0;
      if (score > bestScore) {
        best = action;
        bestScore = score;
      }
    }
  }
  return best;
}

/**
 * AI-Assistent. Ohne hinterlegten API-Key antwortet das Backend aus den
 * echten lokalen Daten — das Panel ist also auch ohne Konfiguration nützlich.
 */
export function AiAssistantPanel({
  className,
  variant = "panel",
}: {
  className?: string;
  /** `overlay` lässt das Panel-Gehäuse weg — das liefert das Fenster. */
  variant?: "panel" | "overlay";
}) {
  const { config, reloadHomeAssistant } = useDashboard();
  const { reloadTimers } = useTimers();

  /**
   * Werkzeuge, die der Sprachassistent auslösen darf. Die Rückgabe geht als
   * Text an das Modell zurück — deshalb kurze, sprechbare Formulierungen.
   */
  const executeTool = useCallback<ToolExecutor>(
    async (name, args) => {
      switch (name) {
        case "timer_stellen": {
          const seconds = Number(args.sekunden);
          const timer = await api.createTimer({
            kind: "timer",
            seconds,
            label:
              typeof args.bezeichnung === "string"
                ? args.bezeichnung
                : undefined,
          });
          await reloadTimers();
          return {
            erfolg: true,
            bezeichnung: timer.label,
            laufzeit_minuten: Math.round(seconds / 60),
          };
        }

        case "wecker_stellen": {
          const timer = await api.createTimer({
            kind: "alarm",
            time: String(args.uhrzeit ?? ""),
            label:
              typeof args.bezeichnung === "string"
                ? args.bezeichnung
                : undefined,
            repeatWeekdays: Array.isArray(args.wochentage)
              ? (args.wochentage as number[])
              : undefined,
          });
          await reloadTimers();
          return {
            erfolg: true,
            bezeichnung: timer.label,
            klingelt_am: new Date(timer.dueAt).toLocaleString("de-DE"),
          };
        }

        case "timer_auflisten": {
          const list = await api.timers();
          return {
            eintraege: list.timers
              .filter((entry) => entry.enabled)
              .map((entry) => ({
                bezeichnung: entry.label,
                art: entry.kind === "alarm" ? "Wecker" : "Timer",
                faellig: new Date(entry.dueAt).toLocaleString("de-DE"),
              })),
          };
        }

        case "timer_loeschen": {
          const wanted = String(args.bezeichnung ?? "").toLowerCase();
          const list = await api.timers();
          const match = list.timers.find((entry) =>
            entry.label.toLowerCase().includes(wanted),
          );
          if (!match)
            return { erfolg: false, grund: "Kein passender Eintrag gefunden" };
          await api.deleteTimer(match.id);
          await reloadTimers();
          return { erfolg: true, geloescht: match.label };
        }

        case "smart_home_steuern": {
          const name = String(args.name ?? "").trim();
          const stateOn = !String(args.zustand ?? "an").toLowerCase().startsWith("aus");
          const actions = config?.smartHomeActions ?? [];
          const action = resolveSmartHomeAction(actions, name);

          if (!action) {
            return {
              erfolg: false,
              grund: `Kein Gerät oder keine Szene namens „${name}" gefunden`,
              verfuegbare_namen: actions.map((entry) => entry.label),
            };
          }

          // Szenen sind Einweg-Auslöser — nur Toggle-Geräte haben einen Aus-Dienst.
          const service =
            action.kind === "toggle" && !stateOn
              ? (action.serviceOff ?? "turn_off")
              : action.service;
          try {
            const result = await api.callService({
              domain: action.domain,
              service,
              entityId: action.entityId,
              serviceData: action.serviceData,
            });
            // Kacheln im Smart-Home-Dock sofort auf den neuen Zustand bringen.
            void reloadHomeAssistant();

            return {
              erfolg: true,
              aktion: action.label,
              status: stateOn ? "an" : "aus",
              meldung: result.message,
            };
          } catch (error) {
            return { erfolg: false, grund: error instanceof Error ? error.message : String(error) };
          }
        }

        default:
          return { fehler: `Unbekanntes Werkzeug: ${name}` };
      }
    },
    [config, reloadTimers, reloadHomeAssistant],
  );

  const voice = useRealtimeVoice(executeTool);
  const [mode, setMode] = useState<AiMode>("assistant");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const configured = config?.ai.hasApiKey ?? false;

  // Neue Antworten immer sichtbar halten — auch die gesprochenen.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [entries, busy, voice.transcripts]);

  const push = (entry: Omit<Entry, "id">) => {
    setEntries((prev) => [...prev, { ...entry, id: nextId() }]);
  };

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    push({ role: "user", content: question });
    setInput("");
    setBusy(true);

    try {
      const response = await api.chat([{ role: "user", content: question }]);
      push({
        role: "assistant",
        content: response.message.content,
        mode: response.mode,
        error: response.message_error,
      });
    } catch (error) {
      push({
        role: "assistant",
        content: "Der Assistent ist gerade nicht erreichbar.",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  };

  const runQuickAction = async (id: (typeof QUICK_ACTIONS)[number]["id"]) => {
    if (busy) return;

    if (id === "briefing") {
      push({ role: "user", content: "Tagesbriefing" });
      setBusy(true);
      try {
        const response = await api.dailyBriefing();
        push({
          role: "assistant",
          content: response.message.content,
          mode: response.mode,
          error: response.message_error,
        });
      } catch (error) {
        push({
          role: "assistant",
          content: "Briefing konnte nicht erstellt werden.",
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setBusy(false);
      }
      return;
    }

    await ask(
      id === "agenda"
        ? "Was steht heute an?"
        : "Gib mir einen passenden Smart-Home-Vorschlag für jetzt.",
    );
  };

  const gptLiveEnabled = config?.ai.gptLive.enabled ?? false;

  /** Umschalter zwischen eigenem Assistenten und der ChatGPT-Verknüpfung. */
  const modeSwitch = gptLiveEnabled ? (
    <div className="flex shrink-0 gap-1.5 border-b border-white/[0.055] p-2.5">
      {[
        { id: "assistant" as const, label: "Cindralux Assistant" },
        { id: "gpt-live" as const, label: "GPT Live" },
      ].map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => setMode(entry.id)}
          className={cx(
            "touchable min-h-[44px] flex-1 rounded-[3px] border text-2xs uppercase tracking-wide2",
            mode === entry.id
              ? "border-accent/50 bg-accent/15 text-accent-soft"
              : "border-white/[0.08] bg-white/[0.02] text-zinc-400",
          )}
        >
          {entry.label}
        </button>
      ))}
    </div>
  ) : null;

  const body = (
    <>
      {modeSwitch}
      {mode === "gpt-live" ? (
        <GptLiveView />
      ) : (
        <>
          {/* Verlauf */}
          <div
            ref={scrollRef}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar overscroll-contain px-3.5 py-3 short:py-2"
          >
            {entries.length === 0 &&
              voice.transcripts.length === 0 &&
              !busy && (
                <div className="m-auto flex flex-col gap-2 px-1 short:hidden">
                  <p className="text-sm leading-relaxed text-zinc-500 short:text-2xs">
                    Frag nach dem Tag, dem Wetter oder dem Smart Home.
                  </p>
                  <p className="hidden text-3xs text-zinc-700 sm:block short:hidden">
                    {configured
                      ? "Kalender, Wetter und Müllabfuhr werden als Kontext mitgeschickt."
                      : "Kein API-Key hinterlegt — Antworten kommen aus den lokalen Daten."}
                  </p>
                </div>
              )}

            {/* mt-auto haelt kurze Verlaeufe unten am Eingabefeld. */}
            <div className="mt-auto space-y-2.5">
              {entries.map((entry) => (
                <MessageBubble key={entry.id} entry={entry} />
              ))}
              {voice.transcripts.map((line) => (
                <MessageBubble
                  key={line.id}
                  entry={{
                    id: line.id,
                    role: line.role,
                    content: line.text,
                    spoken: true,
                    partial: line.partial,
                  }}
                />
              ))}
            </div>

            {busy && (
              <div className="flex shrink-0 items-center gap-2.5 px-1 pt-2.5">
                <span className="flex gap-1">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent"
                      style={{ animationDelay: `${dot * 180}ms` }}
                    />
                  ))}
                </span>
                <span className="text-3xs uppercase tracking-wide2 text-zinc-600">
                  denkt nach
                </span>
              </div>
            )}
          </div>

          <VoiceBar voice={voice} />

          {/* Schnellaktionen */}
          <div className="flex shrink-0 gap-1.5 px-2.5 pb-2 short:pb-1.5">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={busy}
                onClick={() => void runQuickAction(action.id)}
                className="btn min-h-[46px] min-w-0 flex-1 px-2 disabled:opacity-30 short:min-h-[40px]"
                title={action.title}
              >
                <action.icon size={15} strokeWidth={1.6} className="shrink-0" />
                <span className="truncate text-3xs short:hidden">
                  {action.label}
                </span>
              </button>
            ))}

            {/*
          Auf flachen Panels ersetzt das Mikrofon die Texteingabe: die
          Bildschirmtastatur würde dort das halbe Dashboard verdecken.
        */}
            <button
              type="button"
              onClick={() =>
                voice.status === "live" ? voice.stop() : void voice.start()
              }
              disabled={voice.status === "connecting"}
              aria-label={
                voice.status === "live"
                  ? "Sprachmodus beenden"
                  : "Sprachmodus starten"
              }
              className={cx(
                "btn hidden min-h-[40px] w-12 shrink-0 px-0 short:flex",
                voice.status === "live" &&
                  "border-signal-err/50 bg-signal-err/15 text-signal-err",
              )}
            >
              {voice.status === "connecting" ? (
                <Loader2 size={16} strokeWidth={1.7} className="animate-spin" />
              ) : voice.status === "live" ? (
                <PhoneOff size={16} strokeWidth={1.7} />
              ) : (
                <Mic size={16} strokeWidth={1.7} />
              )}
            </button>
          </div>

          {/* Eingabe */}
          <form
            className="flex shrink-0 gap-2 border-t border-white/[0.055] p-2.5 short:hidden"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
          >
            <div className="relative min-w-0 flex-1">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Frage stellen …"
                enterKeyHint="send"
                className="field pr-11"
                disabled={busy}
              />
              {input && (
                <button
                  type="button"
                  onClick={() => setInput("")}
                  aria-label="Eingabe löschen"
                  className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[3px] text-zinc-600 active:text-zinc-300"
                >
                  <X size={16} strokeWidth={1.8} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                voice.status === "live" ? voice.stop() : void voice.start()
              }
              disabled={voice.status === "connecting"}
              aria-label={
                voice.status === "live"
                  ? "Sprachmodus beenden"
                  : "Sprachmodus starten"
              }
              title={
                configured
                  ? "Sprachmodus (OpenAI Realtime)"
                  : "Sprachmodus benötigt einen OpenAI-API-Key"
              }
              className={cx(
                "btn w-[58px] shrink-0 px-0",
                voice.status === "live" &&
                  "border-signal-err/50 bg-signal-err/15 text-signal-err",
                voice.status === "error" &&
                  "border-signal-err/40 text-signal-err",
              )}
            >
              {voice.status === "connecting" ? (
                <Loader2 size={18} strokeWidth={1.7} className="animate-spin" />
              ) : voice.status === "live" ? (
                <PhoneOff size={18} strokeWidth={1.7} />
              ) : (
                <Mic size={18} strokeWidth={1.7} />
              )}
            </button>

            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Absenden"
              className="btn btn-accent w-[58px] shrink-0 px-0"
            >
              <Send size={18} strokeWidth={1.6} />
            </button>
          </form>
        </>
      )}
    </>
  );

  // Im Fenster liefert der Rahmen die Kopfzeile; hier nur der Inhalt.
  if (variant === "overlay") {
    return <div className={cx("flex min-h-0 flex-col", className)}>{body}</div>;
  }

  return (
    <Panel
      title="Assistent"
      className={className}
      icon={<Sparkles size={13} strokeWidth={1.6} />}
      meta={
        <span
          className={
            mode === "gpt-live"
              ? "text-zinc-500"
              : configured
                ? "text-signal-ok"
                : "text-zinc-600"
          }
        >
          {mode === "gpt-live"
            ? "chatgpt.com"
            : voice.status === "live"
              ? "Sprachmodus"
              : configured
                ? config?.ai.model
                : "lokal"}
        </span>
      }
      bodyClassName="flex flex-col"
    >
      {body}
    </Panel>
  );
}

function MessageBubble({ entry }: { entry: Entry }) {
  const isUser = entry.role === "user";

  return (
    <div
      className={cx(
        "flex animate-rise",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cx(
          "max-w-[92%] rounded-[3px] border px-3 py-2.5",
          isUser
            ? "border-accent/25 bg-accent/[0.09] text-zinc-100"
            : "border-white/[0.07] bg-white/[0.025] text-zinc-300",
        )}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {entry.content}
          {entry.partial && (
            <span className="ml-1 inline-block h-3.5 w-[2px] animate-pulse-soft bg-accent align-middle" />
          )}
        </p>

        {entry.spoken && (
          <p className="mt-1.5 flex items-center gap-1 text-3xs text-zinc-600">
            <Mic size={9} strokeWidth={2} />
            gesprochen
          </p>
        )}

        {!isUser && (entry.mode === "mock" || entry.error) && (
          <p className="mt-2 border-t border-white/[0.06] pt-1.5 text-3xs text-zinc-600">
            {entry.error ? `Fehler: ${entry.error} — ` : ""}
            aus lokalen Daten beantwortet
          </p>
        )}
      </div>
    </div>
  );
}
