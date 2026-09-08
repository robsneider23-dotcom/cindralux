import {
  Activity,
  AlertTriangle,
  FileUp,
  Bot,
  CalendarDays,
  Check,
  House,
  Link2,
  Lock,
  Loader2,
  LogOut,
  Moon,
  Palette,
  Power,
  RotateCcw,
  Moon as MoonIcon,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  AppConfigPatch,
  HomeAssistantSensor,
  PublicAppConfig,
  PublicCalendarSource,
  BackdropStyle,
  WindowId,
  SensorIcon,
  TrashSourceKind,
  CalendarView,
  InputDevices,
  ColorScheme,
  SlideshowOrder,
} from "@shared/types";
import { api } from "@/lib/api";
import { useDashboard } from "@/lib/store";
import { backgrounds, calendarPalette } from "@/theme/tokens.js";
import { cx, uid } from "@/lib/utils";
import {
  ColorPicker,
  Field,
  SegmentedControl,
  Section,
  Switch,
  TestButton,
  Toggle,
} from "./settings/SettingsControls";
import { AddGoogleCalendarDialog } from "./settings/AddGoogleCalendarDialog";
import { EntityPicker } from "./settings/EntityPicker";
import { LocationPicker } from "./settings/LocationPicker";
import { GoogleCalendarSetup } from "./settings/GoogleCalendarSetup";
import { LayoutEditor } from "./settings/LayoutEditor";
import { ThemeEditor } from "./settings/ThemeEditor";
import { TransitionPreview } from "./settings/TransitionPreview";
import { PhotoPicker } from "./settings/PhotoPicker";
import { LegalFooter } from "./settings/LegalFooter";
import { PanelBackdrop, BACKDROP_LABELS } from "./PanelBackdrop";
import { ConnectionStatusPill, type StatusTone } from "./ConnectionStatusPill";
import { TRANSITIONS } from "@/lib/transitions";
import { Portal } from "./Portal";

type Tab =
  | "kalender"
  | "muell"
  | "zuhause"
  | "verbindungen"
  | "darstellung"
  | "ruhe"
  | "system";

const TABS: Array<{ id: Tab; label: string; icon: typeof CalendarDays }> = [
  { id: "kalender", label: "Kalender", icon: CalendarDays },
  { id: "muell", label: "Müll & Wetter", icon: Trash2 },
  { id: "zuhause", label: "Zuhause", icon: House },
  { id: "verbindungen", label: "Verbindungen", icon: Link2 },
  { id: "darstellung", label: "Darstellung", icon: Palette },
  { id: "ruhe", label: "Ruhemodus", icon: MoonIcon },
  { id: "system", label: "System", icon: Power },
];

/** Symbole, die für einen Sensor zur Auswahl stehen. */
const SENSOR_ICONS: SensorIcon[] = [
  "temperature",
  "humidity",
  "window",
  "door",
  "power",
  "solar",
  "battery",
  "motion",
  "water",
  "washer",
  "presence",
  "generic",
];

/**
 * Kalenderquelle im Bearbeitungszustand.
 *
 * Der Server liefert die ICS-Adresse nie aus (sie ist bei Google eine
 * Geheimadresse). `url` existiert deshalb nur, wenn der Nutzer gerade eine
 * neue eintippt — sonst bleibt das Feld weg und der Server behält die
 * gespeicherte Adresse.
 */
type DraftCalendar = PublicCalendarSource & { url?: string };

/**
 * Konfiguration im Bearbeitungszustand.
 *
 * Wie beim Kalender gilt auch für die Abfuhr-Adresse: Der Client bekommt sie
 * nie zu sehen; die Felder existieren nur, wenn gerade etwas eingetippt wurde.
 */
type DraftConfig = Omit<PublicAppConfig, "calendars" | "trash"> & {
  calendars: DraftCalendar[];
  trash: PublicAppConfig["trash"] & { icsUrl?: string; icsContent?: string };
};

const WEEKDAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

/**
 * Einstellungen als Vollbild-Overlay. Auf einem Kiosk-Panel gibt es keine
 * Browser-Navigation — das Overlay ist der einzige zweite „Screen".
 */
/**
 * Zeigt, was das System an Eingabegeräten meldet. Ohne das rät man bei
 * „Automatisch" nur, warum die Tastatur kommt oder eben nicht.
 */
/* -------------------------------------------------------------------------- */
/* System                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Neustart und Herunterfahren.
 *
 * „Herunterfahren" ist hier wichtiger als der Neustart: Wer den Stecker eines
 * laufenden Pi zieht, riskiert ein beschädigtes Dateisystem — genau daran ist
 * auf diesem Gerät schon einmal der Browser zerbrochen.
 */
function SystemSettings() {
  const [verfuegbar, setVerfuegbar] = useState<boolean | null>(null);
  const [frage, setFrage] = useState<"reboot" | "shutdown" | "exit-kiosk" | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  useEffect(() => {
    let weg = false;
    api
      .powerAvailable()
      .then((a) => !weg && setVerfuegbar(a.available))
      .catch(() => !weg && setVerfuegbar(false));
    return () => {
      weg = true;
    };
  }, []);

  const ausfuehren = async (aktion: "reboot" | "shutdown" | "exit-kiosk") => {
    setLaeuft(true);
    setFrage(null);
    try {
      const antwort = await api.power(aktion);
      setMeldung(antwort.message);
    } catch (fehler) {
      setMeldung(fehler instanceof Error ? fehler.message : String(fehler));
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <>
      <Section
        title="Gerät"
        description="Neustart und Herunterfahren des Raspberry Pi."
      >
        {verfuegbar === false && (
          <div className="mb-4 rounded-[3px] border border-signal-warn/30 bg-signal-warn/10 p-3">
            <p className="text-2xs leading-relaxed text-zinc-300">
              <strong className="text-signal-warn">Einmalig einrichten.</strong>{" "}
              Der Dienst läuft als normaler Benutzer und darf das Gerät nicht
              ausschalten. Führ auf dem Pi einmal aus:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-[2px] bg-black/40 p-2 text-[10px] leading-relaxed text-zinc-400">
              sudo cp ~/cindralux/deploy/cindralux-power.sudoers
              /etc/sudoers.d/cindralux-power{"\n"}sudo chmod 440
              /etc/sudoers.d/cindralux-power
            </pre>
            <p className="mt-2 text-2xs text-zinc-500">
              Die Regel erlaubt ausschließlich Neustart und Herunterfahren —
              kein allgemeines Administratorrecht.
            </p>
          </div>
        )}

        {meldung && (
          <p className="mb-4 rounded-[3px] border border-white/[0.09] bg-white/[0.02] p-3 text-2xs leading-relaxed text-zinc-300">
            {meldung}
          </p>
        )}

        {frage ? (
          <div className="rounded-[3px] border border-accent/40 bg-accent/10 p-3">
            <p className="mb-3 text-2xs leading-relaxed text-zinc-200">
              {frage === "reboot"
                ? "Pi wirklich neu starten? Das Dashboard ist etwa eine Minute lang weg."
                : frage === "shutdown"
                  ? "Pi wirklich herunterfahren? Zum Wiedereinschalten musst du den Strom kurz trennen."
                  : "Kiosk wirklich beenden? Der Bildschirm zeigt danach den bloßen Desktop, ohne automatischen Neustart. Ohne Tastatur/Maus am Pi kommst du nur per SSH oder einem Neustart zurück zum Dashboard."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn flex-1 border-accent/50 text-accent-soft"
                onClick={() => void ausfuehren(frage)}
              >
                {frage === "reboot" && "Ja, neu starten"}
                {frage === "shutdown" && "Ja, herunterfahren"}
                {frage === "exit-kiosk" && "Ja, Kiosk beenden"}
              </button>
              <button
                type="button"
                className="btn flex-1"
                onClick={() => setFrage(null)}
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={laeuft || verfuegbar === false}
              className="btn flex-1 disabled:opacity-40"
              onClick={() => setFrage("reboot")}
            >
              <RotateCcw className="h-4 w-4" />
              Neu starten
            </button>
            <button
              type="button"
              disabled={laeuft || verfuegbar === false}
              className="btn flex-1 disabled:opacity-40"
              onClick={() => setFrage("shutdown")}
            >
              <Power className="h-4 w-4" />
              Herunterfahren
            </button>
            <button
              type="button"
              disabled={laeuft}
              className="btn flex-1 disabled:opacity-40"
              onClick={() => setFrage("exit-kiosk")}
            >
              <LogOut className="h-4 w-4" />
              Kiosk beenden
            </button>
          </div>
        )}

        <p className="mt-3 text-2xs leading-relaxed text-zinc-500">
          Vor dem Stromtrennen bitte herunterfahren. Ein hart ausgeschalteter Pi
          kann ein beschädigtes Dateisystem zurücklassen. „Kiosk beenden" braucht
          keine sudo-Regel — nur Neustart und Herunterfahren tun das.
        </p>
      </Section>

      <Section
        title="Eingabegeräte"
        description="Was das System angeschlossen sieht. Bestimmt, ob die Bildschirmtastatur im Automatikmodus erscheint."
      >
        <InputDeviceHint />
      </Section>
    </>
  );
}

function InputDeviceHint() {
  const [geraete, setGeraete] = useState<InputDevices | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    api
      .inputDevices()
      .then((antwort) => !abgebrochen && setGeraete(antwort))
      .catch(() => undefined);
    return () => {
      abgebrochen = true;
    };
  }, []);

  if (!geraete) return null;

  return (
    <p className="mt-2 text-2xs text-zinc-500">
      System meldet:{" "}
      <span className={geraete.physicalKeyboard ? "text-signal-ok" : "text-zinc-400"}>
        {geraete.physicalKeyboard ? "Tastatur angeschlossen" : "keine Tastatur"}
      </span>
      {geraete.touchScreen && " · Touchscreen erkannt"}
    </p>
  );
}

export function SettingsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { config, reloadAll } = useDashboard();
  const [draft, setDraft] = useState<DraftConfig | null>(null);
  const [tab, setTab] = useState<Tab>("kalender");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Secrets werden nie ausgeliefert. Leer = unverändert lassen.
  const [haToken, setHaToken] = useState("");
  const [aiKey, setAiKey] = useState("");

  // Beim Öffnen einen frischen Entwurf ziehen, damit ein Abbruch nichts ändert.
  useEffect(() => {
    if (open && config) {
      setDraft(structuredClone(config));
      setHaToken("");
      setAiKey("");
      setSaved(false);
      setSaveError(null);
    }
  }, [open, config]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !draft) return null;

  const update = (patch: Partial<DraftConfig>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const patch: AppConfigPatch = {
        // Leere Adresse = unverändert lassen. Der Server kennt die echte,
        // der Client nie — deshalb wird hier nur mitgeschickt, was neu
        // eingetippt wurde.
        calendars: draft.calendars.map((entry) => ({
          ...entry,
          url: entry.url ?? "",
        })),
        trashRules: draft.trashRules,
        trash: draft.trash,
        calendarView: draft.calendarView,
        smartHomeActions: draft.smartHomeActions,
        sensors: draft.sensors,
        idle: draft.idle,
        photos: draft.photos,
        weather: draft.weather,
        appearance: draft.appearance,
        layout: draft.layout,
        calendarRefreshMinutes: draft.calendarRefreshMinutes,
        homeAssistant: {
          baseUrl: draft.homeAssistant.baseUrl,
          ...(haToken ? { token: haToken } : {}),
        },
        ai: {
          baseUrl: draft.ai.baseUrl,
          model: draft.ai.model,
          systemPrompt: draft.ai.systemPrompt,
          realtime: draft.ai.realtime,
          gptLive: draft.ai.gptLive,
          ...(aiKey ? { apiKey: aiKey } : {}),
        },
      };

      await api.saveConfig(patch);
      await reloadAll();
      setSaved(true);
      setHaToken("");
      setAiKey("");
      window.setTimeout(() => setSaved(false), 2600);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl animate-rise">
        <div className="panel scanlines noise m-3 flex min-h-0 flex-1 flex-col bg-surface-800 md:m-5">
          {/* Kopf */}
          <header className="panel-head">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-3.5 w-[2px] shrink-0 rounded-full"
                style={{
                  background: "rgb(var(--accent))",
                  boxShadow: "0 0 10px rgb(var(--accent))",
                }}
              />
              <h2 className="label text-zinc-300">Einstellungen</h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className={cx(
                  "btn btn-accent min-h-[46px] px-5",
                  saved && "border-signal-ok/50 bg-signal-ok/10 text-signal-ok",
                )}
              >
                {saving ? (
                  <Loader2
                    size={15}
                    strokeWidth={1.8}
                    className="animate-spin"
                  />
                ) : saved ? (
                  <Check size={15} strokeWidth={2} />
                ) : null}
                {saved ? "Gespeichert" : "Speichern"}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Einstellungen schließen"
                className="touchable flex h-[46px] w-[46px] min-h-0 items-center justify-center rounded-[3px] border border-white/[0.09] bg-white/[0.028] text-zinc-400 active:border-accent/50 active:text-accent-soft"
              >
                <X size={20} strokeWidth={1.8} />
              </button>
            </div>
          </header>

          {saveError && (
            <p role="alert" className="mx-4 my-2 shrink-0 text-sm text-signal-warn">
              Einstellungen konnten nicht gespeichert werden: {saveError}
            </p>
          )}

          <div className="flex min-h-0 flex-1">
            {/* Reiter */}
            <nav className="flex w-[13.5rem] shrink-0 flex-col gap-1.5 border-r border-white/[0.055] p-2.5">
              {TABS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setTab(entry.id)}
                  className={cx(
                    "touchable flex items-center gap-3 rounded-[3px] border px-3.5 text-left text-2xs uppercase tracking-wide2",
                    tab === entry.id
                      ? "border-accent/40 bg-accent/[0.12] text-accent-soft"
                      : "border-transparent text-zinc-500 active:bg-white/[0.03]",
                  )}
                >
                  <entry.icon
                    size={16}
                    strokeWidth={1.6}
                    className="shrink-0"
                  />
                  <span className="truncate">{entry.label}</span>
                </button>
              ))}

              <LegalFooter />
            </nav>

            {/* Inhalt */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {tab === "kalender" && (
                <CalendarSettings draft={draft} update={update} />
              )}
              {tab === "muell" && (
                <TrashWeatherSettings draft={draft} update={update} />
              )}
              {tab === "zuhause" && (
                <HomeSettings draft={draft} update={update} />
              )}
              {tab === "verbindungen" && (
                <ConnectionSettings
                  draft={draft}
                  update={update}
                  haToken={haToken}
                  setHaToken={setHaToken}
                  aiKey={aiKey}
                  setAiKey={setAiKey}
                />
              )}
              {tab === "ruhe" && <IdleSettings draft={draft} update={update} />}
              {tab === "system" && <SystemSettings />}
              {tab === "darstellung" && (
                <AppearanceSettings draft={draft} update={update} />
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

interface PaneProps {
  draft: DraftConfig;
  update: (patch: Partial<DraftConfig>) => void;
}

/* -------------------------------------------------------------------------- */
/* Kalender                                                                    */
/* -------------------------------------------------------------------------- */

function CalendarSettings({ draft, update }: PaneProps) {
  const [googleDialog, setGoogleDialog] = useState(false);

  const setCalendar = (id: string, patch: Partial<DraftCalendar>) => {
    update({
      calendars: draft.calendars.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    });
  };

  const removeCalendar = (id: string) => {
    update({ calendars: draft.calendars.filter((entry) => entry.id !== id) });
  };

  const addCalendar = (source: DraftCalendar) => {
    update({ calendars: [...draft.calendars, source] });
  };

  const addBlankCalendar = () => {
    const color = calendarPalette[
      draft.calendars.length % calendarPalette.length
    ] as string;
    addCalendar({
      id: uid("cal"),
      name: "Neuer Kalender",
      color,
      url: "",
      hasUrl: false,
      enabled: true,
      provider: "ics",
    });
  };

  // Nach Konto gruppieren; Kalender ohne Konto landen in einer eigenen Gruppe.
  const groups = new Map<string, DraftCalendar[]>();
  for (const calendar of draft.calendars) {
    const key = calendar.account?.trim() || "";
    const list = groups.get(key) ?? [];
    list.push(calendar);
    groups.set(key, list);
  }

  const knownAccounts = [...groups.keys()].filter(Boolean);
  const usedColors = draft.calendars.map((entry) => entry.color);

  return (
    <>
      <Section
        title="Google Kalender"
        description="Verbindet ein Google-Konto über die offizielle API — nahezu live statt bis zu 24 Stunden Verzögerung, und Serientermine löst Google selbst auf. Einrichtung: docs/google-kalender.md"
      >
        <GoogleCalendarSetup
          clientId={draft.google.clientId}
          hasClientSecret={draft.google.hasClientSecret}
          sources={draft.calendars}
          onChangeCredentials={(patch) =>
            update({
              google: { ...draft.google, ...patch } as typeof draft.google,
            })
          }
          onAddSource={(source) =>
            update({ calendars: [...draft.calendars, source] })
          }
          onRemoveSource={(googleCalendarId) =>
            update({
              calendars: draft.calendars.filter(
                (entry) => entry.googleCalendarId !== googleCalendarId,
              ),
            })
          }
        />
      </Section>

      <Section
        title="Kalenderquellen"
        description="Alle eingebundenen Kalender. Google-Quellen über die API stehen oben; hier lassen sich zusätzlich ICS-Adressen eintragen."
        action={
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setGoogleDialog(true)}
              className="btn btn-accent min-h-[46px]"
            >
              <Plus size={15} strokeWidth={2} />
              Google-Kalender
            </button>
            <button
              type="button"
              onClick={addBlankCalendar}
              className="btn min-h-[46px]"
            >
              <Link2 size={15} strokeWidth={1.8} />
              Andere ICS-URL
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          {[...groups.entries()].map(([account, calendars]) => (
            <div key={account || "__none__"}>
              {/* Kontokopf */}
              <div className="mb-2.5 flex items-center gap-2.5">
                <User
                  size={13}
                  strokeWidth={1.7}
                  className="shrink-0 text-zinc-600"
                />
                <span className="text-2xs font-medium text-zinc-300">
                  {account || "Ohne Konto"}
                </span>
                <span className="digits text-3xs text-zinc-600">
                  {calendars.length}{" "}
                  {calendars.length === 1 ? "Kalender" : "Kalender"}
                </span>
                <span className="hair ml-1 flex-1" />
              </div>

              <div className="space-y-2.5">
                {calendars.map((calendar) => (
                  <CalendarRow
                    key={calendar.id}
                    calendar={calendar}
                    onChange={(patch) => setCalendar(calendar.id, patch)}
                    onRemove={() => removeCalendar(calendar.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Ansicht"
        description="Welche Ansicht der Kalender zeigt und wohin er von allein zurückkehrt."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field
            label="Standardansicht"
            hint="Diese Ansicht wird nach Inaktivität wiederhergestellt."
          >
            <SegmentedControl<CalendarView>
              value={draft.calendarView.defaultView}
              onChange={(defaultView) =>
                update({ calendarView: { ...draft.calendarView, defaultView } })
              }
              options={[
                { value: "tag", label: "Tag" },
                { value: "woche", label: "Woche" },
                { value: "monat", label: "Monat" },
              ]}
            />
          </Field>

          <Field
            label="Zurückschalten nach (Minuten)"
            hint="0 schaltet die automatische Rückkehr ab. Jede Bedienung setzt die Frist neu."
          >
            <input
              type="number"
              min={0}
              max={120}
              value={draft.calendarView.autoReturnMinutes}
              onChange={(event) =>
                update({
                  calendarView: {
                    ...draft.calendarView,
                    autoReturnMinutes: Math.max(
                      0,
                      Number(event.target.value) || 0,
                    ),
                  },
                })
              }
              className="field digits w-40"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Aktualisierung"
        description="Wie oft die ICS-Quellen neu geladen werden."
      >
        <Field label="Intervall in Minuten">
          <input
            type="number"
            min={1}
            max={240}
            value={draft.calendarRefreshMinutes}
            onChange={(event) =>
              update({
                calendarRefreshMinutes: Math.max(
                  1,
                  Number(event.target.value) || 15,
                ),
              })
            }
            className="field digits w-36"
          />
        </Field>
        <p className="mt-2.5 max-w-xl text-3xs leading-relaxed text-zinc-600">
          Gilt für das Abholen durch dieses Dashboard. Wie schnell Google selbst
          neue Termine in den iCal-Feed schreibt, lässt sich davon nicht
          beeinflussen — dort können bis zu 24 Stunden vergehen.
        </p>
        <div className="mt-4 w-64">
          <TestButton label="Kalender testen" run={api.testCalendar} />
        </div>
      </Section>

      {googleDialog && (
        <AddGoogleCalendarDialog
          knownAccounts={knownAccounts}
          usedColors={usedColors}
          onCancel={() => setGoogleDialog(false)}
          onAdd={(source) => {
            addCalendar(source);
            setGoogleDialog(false);
          }}
        />
      )}
    </>
  );
}

/** Eine Kalenderzeile mit Name, Adresse, Farbe und Schalter. */
function CalendarRow({
  calendar,
  onChange,
  onRemove,
}: {
  calendar: DraftCalendar;
  onChange: (patch: Partial<DraftCalendar>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-[3px] border border-white/[0.07] bg-white/[0.015] p-3.5">
      <div className="flex items-center gap-3">
        <span
          className="h-9 w-1 shrink-0 rounded-full"
          style={{
            background: calendar.color,
            boxShadow: `0 0 12px ${calendar.color}`,
          }}
        />
        <input
          value={calendar.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Kalendername"
          className="field min-h-[46px] flex-1"
        />
        {calendar.provider === "google-api" ? (
          <span className="shrink-0 rounded-[2px] border border-signal-ok/25 bg-signal-ok/[0.07] px-2 py-1.5 text-3xs uppercase tracking-wide2 text-signal-ok">
            Google API
          </span>
        ) : calendar.provider === "google" ? (
          <span className="shrink-0 rounded-[2px] border border-white/[0.08] px-2 py-1.5 text-3xs uppercase tracking-wide2 text-zinc-500">
            Google ICS
          </span>
        ) : null}
        <Switch
          label={`${calendar.name} aktivieren`}
          checked={calendar.enabled}
          onChange={(enabled) => onChange({ enabled })}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${calendar.name} löschen`}
          className="touchable flex h-[46px] w-[46px] min-h-0 shrink-0 items-center justify-center rounded-[3px] border border-white/[0.08] text-zinc-500 active:border-signal-err/50 active:text-signal-err"
        >
          <Trash2 size={17} strokeWidth={1.6} />
        </button>
      </div>

      {/* Bei API-Quellen gibt es keine Adresse — dort zählt die Kalender-ID. */}
      <div className="mt-3">
        {calendar.provider === "google-api" ? (
          <p className="digits rounded-[3px] border border-white/[0.06] bg-black/20 px-3.5 py-3 text-2xs text-zinc-500">
            {calendar.googleCalendarId}
          </p>
        ) : (
          <>
            <input
              value={calendar.url ?? ""}
              onChange={(event) => onChange({ url: event.target.value })}
              placeholder={
                calendar.hasUrl
                  ? "•••••••••• (hinterlegt) — neue Adresse eintragen zum Ersetzen"
                  : "https://… .ics   (leer lassen für Demodaten)"
              }
              spellCheck={false}
              autoCapitalize="off"
              className="field min-h-[46px] font-mono text-2xs"
            />
            {calendar.hasUrl && (
              <span className="mt-1.5 flex items-center gap-2 text-3xs text-zinc-600">
                <Lock size={10} strokeWidth={2} />
                <span className="digits">{calendar.urlHint}</span>
                <button
                  type="button"
                  onClick={() => onChange({ url: "__clear__" })}
                  className="underline underline-offset-2"
                >
                  Adresse entfernen
                </button>
              </span>
            )}
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <ColorPicker
          value={calendar.color}
          palette={calendarPalette}
          onChange={(color) => onChange({ color })}
        />
        <input
          value={calendar.account ?? ""}
          onChange={(event) =>
            onChange({ account: event.target.value || undefined })
          }
          placeholder="Konto (optional)"
          spellCheck={false}
          autoCapitalize="off"
          className="field min-h-[46px] w-56"
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Müll & Wetter                                                               */
/* -------------------------------------------------------------------------- */

function TrashWeatherSettings({ draft, update }: PaneProps) {
  return (
    <>
      <Section
        title="Abfuhrkalender"
        description="Entweder eigene Regeln oder der Kalender des Entsorgers."
      >
        <SegmentedControl<TrashSourceKind>
          value={draft.trash.source}
          onChange={(source) => update({ trash: { ...draft.trash, source } })}
          options={[
            { value: "rules", label: "Eigene Regeln" },
            { value: "ics", label: "Kalender des Entsorgers" },
          ]}
        />

        {draft.trash.source === "ics" && (
          <div className="mt-4">
            <Field
              label="ICS-Adresse"
              hint="Viele Entsorger bieten einen Abfuhrkalender zum Abonnieren an. Die Tonnenart wird aus der Terminbezeichnung erkannt."
            >
              <div className="flex gap-2">
                <input
                  value={draft.trash.icsUrl ?? ""}
                  onChange={(event) =>
                    update({
                      trash: { ...draft.trash, icsUrl: event.target.value },
                    })
                  }
                  placeholder={
                    draft.trash.hasIcsUrl
                      ? "•••••••••• (hinterlegt) — neue Adresse eintragen zum Ersetzen"
                      : "https://…"
                  }
                  spellCheck={false}
                  autoCapitalize="off"
                  className="field min-w-0 flex-1 font-mono text-2xs"
                />
                <TrashIcsTest url={draft.trash.icsUrl ?? ""} />
              </div>
            </Field>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="btn min-h-[48px] cursor-pointer px-5">
                <FileUp size={15} strokeWidth={1.8} />
                ICS-Datei wählen
                <input
                  type="file"
                  accept=".ics,text/calendar"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    update({
                      trash: {
                        ...draft.trash,
                        icsContent: text,
                        icsFileName: file.name,
                        // Eine Datei ersetzt die Adresse — sonst gewinne die URL.
                        icsUrl: "",
                      },
                    });
                  }}
                />
              </label>

              {draft.trash.icsFileName ? (
                <span className="flex items-center gap-2 text-3xs text-zinc-400">
                  <Check size={13} strokeWidth={2} className="text-signal-ok" />
                  {draft.trash.icsFileName}
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        trash: {
                          ...draft.trash,
                          icsContent: "",
                          icsFileName: "",
                        },
                      })
                    }
                    className="text-zinc-600 underline underline-offset-2"
                  >
                    entfernen
                  </button>
                </span>
              ) : (
                <span className="text-3xs text-zinc-600">
                  Alternativ, wenn der Entsorger nur einen Download anbietet.
                </span>
              )}
            </div>

            <p className="mt-4 flex items-start gap-2.5 rounded-[3px] border border-white/[0.07] bg-white/[0.015] p-3.5 text-3xs leading-relaxed text-zinc-500">
              <AlertTriangle
                size={14}
                strokeWidth={1.7}
                className="mt-px shrink-0 text-zinc-600"
              />
              Ist eine Adresse eingetragen, hat sie Vorrang vor der Datei. Die
              Adresse wird höchstens alle sechs Stunden neu abgerufen —
              Abfuhrkalender ändern sich selten.
            </p>
          </div>
        )}
      </Section>

      <Section
        title="Eigene Regeln"
        description="Gelten, solange oben „Eigene Regeln“ gewählt ist. Das Ankerdatum legt den Rhythmus mehrwöchiger Regeln fest."
      >
        <div className="space-y-2.5">
          {draft.trashRules.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-wrap items-end gap-3 rounded-[3px] border border-white/[0.07] bg-white/[0.015] p-3.5"
            >
              <span
                className="h-11 w-1 shrink-0 self-center rounded-full"
                style={{
                  background: rule.color,
                  boxShadow: `0 0 12px ${rule.color}`,
                }}
              />

              <div className="min-w-[10rem] flex-1">
                <Field label="Bezeichnung">
                  <input
                    value={rule.label}
                    onChange={(event) =>
                      update({
                        trashRules: draft.trashRules.map((entry) =>
                          entry.id === rule.id
                            ? { ...entry, label: event.target.value }
                            : entry,
                        ),
                      })
                    }
                    className="field min-h-[46px]"
                  />
                </Field>
              </div>

              <div className="w-40">
                <Field label="Wochentag">
                  <select
                    value={rule.weekday}
                    onChange={(event) =>
                      update({
                        trashRules: draft.trashRules.map((entry) =>
                          entry.id === rule.id
                            ? { ...entry, weekday: Number(event.target.value) }
                            : entry,
                        ),
                      })
                    }
                    className="field min-h-[46px]"
                  >
                    {WEEKDAYS.map((day, index) => (
                      <option
                        key={day}
                        value={index}
                        className="bg-surface-700"
                      >
                        {day}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="w-32">
                <Field label="Rhythmus">
                  <select
                    value={rule.everyNWeeks}
                    onChange={(event) =>
                      update({
                        trashRules: draft.trashRules.map((entry) =>
                          entry.id === rule.id
                            ? {
                                ...entry,
                                everyNWeeks: Number(event.target.value),
                              }
                            : entry,
                        ),
                      })
                    }
                    className="field min-h-[46px]"
                  >
                    <option value={1} className="bg-surface-700">
                      wöchentlich
                    </option>
                    <option value={2} className="bg-surface-700">
                      14-tägig
                    </option>
                    <option value={4} className="bg-surface-700">
                      4-wöchig
                    </option>
                  </select>
                </Field>
              </div>

              <div className="w-44">
                <Field label="Ankerdatum">
                  <input
                    type="date"
                    value={rule.anchorDate}
                    onChange={(event) =>
                      update({
                        trashRules: draft.trashRules.map((entry) =>
                          entry.id === rule.id
                            ? { ...entry, anchorDate: event.target.value }
                            : entry,
                        ),
                      })
                    }
                    className="field digits min-h-[46px]"
                  />
                </Field>
              </div>

              <Switch
                label={`${rule.label} aktivieren`}
                checked={rule.enabled}
                onChange={(enabled) =>
                  update({
                    trashRules: draft.trashRules.map((entry) =>
                      entry.id === rule.id ? { ...entry, enabled } : entry,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Wetter-Standort"
        description="Daten kommen von Open-Meteo — kein Konto, kein API-Key nötig."
      >
        <LocationPicker
          weather={draft.weather}
          onChange={(patch) =>
            update({ weather: { ...draft.weather, ...patch } })
          }
        />

        <div className="mt-4 w-64">
          <TestButton label="Wetter testen" run={api.testWeather} />
        </div>
      </Section>
    </>
  );
}

/** Prüft die ICS-Adresse des Entsorgers und meldet die gefundenen Tonnenarten. */
function TrashIcsTest({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "fail">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    setState("busy");
    try {
      const result = await api.validateTrashIcs(url);
      setState(result.ok ? "ok" : "fail");
      setMessage(result.message);
    } catch (error) {
      setState("fail");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void run()}
        disabled={state === "busy" || !url.trim()}
        className={cx(
          "btn min-h-[52px] shrink-0 px-5",
          state === "ok" &&
            "border-signal-ok/40 bg-signal-ok/10 text-signal-ok",
          state === "fail" &&
            "border-signal-err/40 bg-signal-err/10 text-signal-err",
        )}
      >
        {state === "busy" && (
          <Loader2 size={15} strokeWidth={1.8} className="animate-spin" />
        )}
        Prüfen
      </button>
      {message && (
        <span
          className={cx(
            "max-w-[22rem] text-3xs leading-relaxed",
            state === "ok" ? "text-signal-ok/80" : "text-signal-err/80",
          )}
        >
          {message}
        </span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Zuhause: Smart-Home-Kacheln und Sensoren                                    */
/* -------------------------------------------------------------------------- */

function HomeSettings({ draft, update }: PaneProps) {
  // Welches Feld gerade eine Entity auswählt: Kachel-ID oder Sensor-ID.
  const [picking, setPicking] = useState<{
    kind: "action" | "sensor";
    id: string;
    value: string;
  } | null>(null);

  const setSensor = (id: string, patch: Partial<HomeAssistantSensor>) => {
    update({
      sensors: draft.sensors.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    });
  };

  const addSensor = () => {
    update({
      sensors: [
        ...draft.sensors,
        {
          id: uid("sensor"),
          label: "Neuer Wert",
          entityId: "",
          icon: "generic",
          enabled: true,
        },
      ],
    });
  };

  const applyPick = (entityId: string) => {
    if (!picking) return;
    if (picking.kind === "sensor") {
      setSensor(picking.id, { entityId });
    } else {
      update({
        smartHomeActions: draft.smartHomeActions.map((entry) =>
          entry.id === picking.id ? { ...entry, entityId } : entry,
        ),
      });
    }
    setPicking({ ...picking, value: entityId });
  };

  return (
    <>
      <Section
        title="Messwerte"
        description="Erscheinen als Leiste über den Schnellaktionen. Ohne Home-Assistant-Verbindung zeigen sie plausible Beispielwerte."
        action={
          <button
            type="button"
            onClick={addSensor}
            className="btn min-h-[46px] shrink-0"
          >
            <Plus size={15} strokeWidth={2} />
            Messwert
          </button>
        }
      >
        <div className="space-y-2.5">
          {draft.sensors.map((sensor) => (
            <div
              key={sensor.id}
              className="flex flex-wrap items-end gap-3 rounded-[3px] border border-white/[0.07] bg-white/[0.015] p-3.5"
            >
              <div className="w-40">
                <Field label="Beschriftung">
                  <input
                    value={sensor.label}
                    onChange={(event) =>
                      setSensor(sensor.id, { label: event.target.value })
                    }
                    className="field min-h-[46px]"
                  />
                </Field>
              </div>

              <div className="min-w-[14rem] flex-1">
                <Field label="Entity">
                  <button
                    type="button"
                    onClick={() =>
                      setPicking({
                        kind: "sensor",
                        id: sensor.id,
                        value: sensor.entityId,
                      })
                    }
                    className="field flex min-h-[46px] items-center gap-2.5 text-left font-mono text-2xs"
                  >
                    <Search
                      size={14}
                      strokeWidth={1.8}
                      className="shrink-0 text-zinc-600"
                    />
                    <span
                      className={cx(
                        "min-w-0 flex-1 truncate",
                        !sensor.entityId && "text-zinc-600",
                      )}
                    >
                      {sensor.entityId || "auswählen …"}
                    </span>
                  </button>
                </Field>
              </div>

              <div className="w-36">
                <Field label="Symbol">
                  <select
                    value={sensor.icon}
                    onChange={(event) =>
                      setSensor(sensor.id, {
                        icon: event.target.value as SensorIcon,
                      })
                    }
                    className="field min-h-[46px]"
                  >
                    {SENSOR_ICONS.map((icon) => (
                      <option
                        key={icon}
                        value={icon}
                        className="bg-surface-700"
                      >
                        {icon}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="w-24">
                <Field label="Stellen">
                  <input
                    type="number"
                    min={0}
                    max={3}
                    value={sensor.decimals ?? 1}
                    onChange={(event) =>
                      setSensor(sensor.id, {
                        decimals: Number(event.target.value),
                      })
                    }
                    className="field digits min-h-[46px]"
                  />
                </Field>
              </div>

              <Switch
                label={`${sensor.label} anzeigen`}
                checked={sensor.enabled}
                onChange={(enabled) => setSensor(sensor.id, { enabled })}
              />

              <button
                type="button"
                onClick={() =>
                  update({
                    sensors: draft.sensors.filter(
                      (entry) => entry.id !== sensor.id,
                    ),
                  })
                }
                aria-label={`${sensor.label} entfernen`}
                className="touchable flex h-[46px] w-[46px] min-h-0 shrink-0 items-center justify-center rounded-[3px] border border-white/[0.08] text-zinc-500 active:border-signal-err/50 active:text-signal-err"
              >
                <Trash2 size={17} strokeWidth={1.6} />
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Schnellaktionen"
        description="Die großen Kacheln am unteren Rand."
      >
        <div className="space-y-2">
          {draft.smartHomeActions.map((action) => (
            <div
              key={action.id}
              className="flex flex-wrap items-center gap-3 rounded-[3px] border border-white/[0.07] bg-white/[0.015] px-3.5 py-3"
            >
              <span
                className="h-8 w-1 shrink-0 rounded-full"
                style={{ background: action.accent ?? "rgb(var(--accent))" }}
              />
              <input
                value={action.label}
                onChange={(event) =>
                  update({
                    smartHomeActions: draft.smartHomeActions.map((entry) =>
                      entry.id === action.id
                        ? { ...entry, label: event.target.value }
                        : entry,
                    ),
                  })
                }
                className="field min-h-[46px] w-40"
              />
              <button
                type="button"
                onClick={() =>
                  setPicking({
                    kind: "action",
                    id: action.id,
                    value: action.entityId ?? "",
                  })
                }
                className="field flex min-h-[46px] flex-1 items-center gap-2.5 text-left font-mono text-2xs"
              >
                <Search
                  size={14}
                  strokeWidth={1.8}
                  className="shrink-0 text-zinc-600"
                />
                <span
                  className={cx(
                    "min-w-0 flex-1 truncate",
                    !action.entityId && "text-zinc-600",
                  )}
                >
                  {action.entityId || "auswählen …"}
                </span>
              </button>
              <span className="digits shrink-0 rounded-[2px] border border-white/[0.08] px-2.5 py-2 text-3xs text-zinc-500">
                {action.domain}.{action.service}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Timer & Wecker" description="Hinweis zur Bedienung.">
        <p className="flex items-start gap-2.5 rounded-[3px] border border-white/[0.07] bg-white/[0.015] p-3.5 text-3xs leading-relaxed text-zinc-500">
          <Activity
            size={15}
            strokeWidth={1.6}
            className="mt-px shrink-0 text-zinc-600"
          />
          Timer lassen sich im Assistenz-Panel mit einem Tipp stellen (5, 10, 20
          Minuten) oder per Sprache: „stell einen Timer auf zehn Minuten", „weck
          mich werktags um Viertel vor sieben". Laufende Timer erscheinen in der
          Kopfleiste, ein abgelaufener meldet sich im Vollbild. Gestellte Wecker
          überleben einen Neustart, kurze Timer bewusst nicht.
        </p>
      </Section>

      {picking && (
        <EntityPicker
          value={picking.value}
          domains={
            picking.kind === "sensor"
              ? ["sensor", "binary_sensor", "person", "device_tracker"]
              : undefined
          }
          onChange={applyPick}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Verbindungen                                                                */
/* -------------------------------------------------------------------------- */

function ConnectionSettings({
  draft,
  update,
  haToken,
  setHaToken,
  aiKey,
  setAiKey,
}: PaneProps & {
  haToken: string;
  setHaToken: (value: string) => void;
  aiKey: string;
  setAiKey: (value: string) => void;
}) {
  const { homeAssistant } = useDashboard();

  const haTone: StatusTone = !homeAssistant
    ? "idle"
    : homeAssistant.connected
      ? "ok"
      : homeAssistant.configured
        ? "err"
        : "warn";
  const haDetail = !homeAssistant
    ? "Verbinde …"
    : homeAssistant.connected
      ? `Verbunden${homeAssistant.version ? ` · ${homeAssistant.version}` : ""}`
      : homeAssistant.configured
        ? (homeAssistant.message ?? "Keine Verbindung")
        : "Simulation";

  const aiConfigured = draft.ai.hasApiKey;
  const aiTone: StatusTone = aiConfigured ? "ok" : "warn";
  const aiDetail = aiConfigured ? draft.ai.model : "Lokale Antworten";

  return (
    <>
      <Section
        title="Home Assistant"
        description="Long-Lived Access Token im HA-Profil unter Sicherheit erzeugen. Ohne Konfiguration laufen die Kacheln im Simulationsmodus."
      >
        <div className="mb-4">
          <ConnectionStatusPill
            label="Status"
            tone={haTone}
            detail={haDetail}
            icon={<House size={13} strokeWidth={1.6} />}
            pulse={haTone === "ok"}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Basis-URL" hint="z. B. http://homeassistant.local:8123">
            <input
              value={draft.homeAssistant.baseUrl}
              onChange={(event) =>
                update({
                  homeAssistant: {
                    ...draft.homeAssistant,
                    baseUrl: event.target.value,
                  },
                })
              }
              placeholder="http://homeassistant.local:8123"
              spellCheck={false}
              autoCapitalize="off"
              className="field font-mono text-2xs"
            />
          </Field>
          <Field
            label="Long-Lived Access Token"
            hint={
              draft.homeAssistant.hasToken
                ? "Ein Token ist hinterlegt. Leer lassen, um es unverändert zu übernehmen."
                : "Noch kein Token hinterlegt."
            }
          >
            <input
              type="password"
              value={haToken}
              onChange={(event) => setHaToken(event.target.value)}
              placeholder={
                draft.homeAssistant.hasToken
                  ? "•••••••••• (gespeichert)"
                  : "Token einfügen"
              }
              spellCheck={false}
              className="field font-mono text-2xs"
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <div className="w-64">
            <TestButton
              label="Home Assistant testen"
              run={api.testHomeAssistant}
            />
          </div>
          <p className="max-w-md text-3xs leading-relaxed text-zinc-600">
            <span className="text-zinc-500">Alexa:</span> bewusst nicht direkt
            angebunden. Der Weg führt später über Home Assistant — Alexa Smart
            Home Skill, HA-Automationen, Node-RED oder Webhooks. Dieses Panel
            spricht ausschließlich mit Home Assistant.
          </p>
        </div>
      </Section>

      <Section
        title="AI-Assistent"
        description="OpenAI-kompatible API. Funktioniert mit OpenAI, LM Studio, Ollama (/v1) und ähnlichen Servern."
      >
        <div className="mb-4">
          <ConnectionStatusPill
            label="Status"
            tone={aiTone}
            detail={aiDetail}
            icon={<Bot size={13} strokeWidth={1.6} />}
            pulse={aiTone === "ok"}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Field
            label="Basis-URL"
            hint="OpenAI: https://api.openai.com/v1 · LM Studio: http://localhost:1234/v1"
          >
            <input
              value={draft.ai.baseUrl}
              onChange={(event) =>
                update({ ai: { ...draft.ai, baseUrl: event.target.value } })
              }
              spellCheck={false}
              autoCapitalize="off"
              className="field font-mono text-2xs"
            />
          </Field>
          <Field label="Modell">
            <input
              value={draft.ai.model}
              onChange={(event) =>
                update({ ai: { ...draft.ai, model: event.target.value } })
              }
              spellCheck={false}
              className="field font-mono text-2xs"
            />
          </Field>
          <Field
            label="API-Key"
            hint={
              draft.ai.hasApiKey
                ? "Ein Key ist hinterlegt. Leer lassen, um ihn unverändert zu übernehmen."
                : "Ohne Key antwortet der Assistent aus den lokalen Daten."
            }
          >
            <input
              type="password"
              value={aiKey}
              onChange={(event) => setAiKey(event.target.value)}
              placeholder={
                draft.ai.hasApiKey ? "•••••••••• (gespeichert)" : "sk-…"
              }
              spellCheck={false}
              className="field font-mono text-2xs"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field
            label="Persona"
            hint="Wird jeder Anfrage als System-Nachricht vorangestellt."
          >
            <textarea
              value={draft.ai.systemPrompt}
              onChange={(event) =>
                update({
                  ai: { ...draft.ai, systemPrompt: event.target.value },
                })
              }
              rows={4}
              className="field resize-none py-3 text-2xs leading-relaxed"
            />
          </Field>
        </div>

        <div className="mt-4 w-64">
          <TestButton label="AI testen" run={api.testAi} />
        </div>
      </Section>

      <Section
        title="GPT Live"
        description="Verknüpfung zu ChatGPT im Browser. ChatGPT lässt sich nicht einbetten — chatgpt.com verbietet die Anzeige in einem Rahmen."
      >
        <div className="mb-4">
          <Toggle
            label="GPT Live anbieten"
            hint="Blendet im Assistenten den Umschalter „Cindralux Assistant / GPT Live“ ein."
            checked={draft.ai.gptLive.enabled}
            onChange={(enabled) =>
              update({
                ai: { ...draft.ai, gptLive: { ...draft.ai.gptLive, enabled } },
              })
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Adresse">
            <input
              value={draft.ai.gptLive.url}
              onChange={(event) =>
                update({
                  ai: {
                    ...draft.ai,
                    gptLive: { ...draft.ai.gptLive, url: event.target.value },
                  },
                })
              }
              spellCheck={false}
              autoCapitalize="off"
              className="field font-mono text-2xs"
            />
          </Field>

          <Field
            label="Öffnen über"
            hint="Im Kiosk-Betrieb landet ein neues Browserfenster oft im selben Vollbild — dann ist der Gerätebefehl zuverlässiger."
          >
            <SegmentedControl<"browser-tab" | "local-command">
              value={draft.ai.gptLive.mode}
              onChange={(mode) =>
                update({
                  ai: { ...draft.ai, gptLive: { ...draft.ai.gptLive, mode } },
                })
              }
              options={[
                { value: "browser-tab", label: "Browserfenster" },
                { value: "local-command", label: "Befehl auf dem Gerät" },
              ]}
            />
          </Field>
        </div>

        {draft.ai.gptLive.mode === "local-command" && (
          <div className="mt-4">
            <Field
              label="Befehl"
              hint="Wird ohne Shell gestartet. Beispiele: brave --app=https://chatgpt.com · chromium --app=https://chatgpt.com · xdg-open https://chatgpt.com"
            >
              <input
                value={draft.ai.gptLive.command}
                onChange={(event) =>
                  update({
                    ai: {
                      ...draft.ai,
                      gptLive: {
                        ...draft.ai.gptLive,
                        command: event.target.value,
                      },
                    },
                  })
                }
                spellCheck={false}
                autoCapitalize="off"
                className="field font-mono text-2xs"
              />
            </Field>

            <p className="mt-3 flex items-start gap-2.5 rounded-[3px] border border-signal-warn/25 bg-signal-warn/[0.06] px-3.5 py-3 text-3xs leading-relaxed text-zinc-400">
              <AlertTriangle
                size={14}
                strokeWidth={1.8}
                className="mt-px shrink-0 text-signal-warn"
              />
              Dieser Befehl wird auf dem Gerät ausgeführt, auf dem der Server
              läuft. Er stammt ausschließlich aus dieser Datei, nie aus einer
              Anfrage — trotzdem gilt: nur eintragen, was du selbst startest.
            </p>
          </div>
        )}
      </Section>

      <Section
        title="Sprachmodus"
        description="Gespräch per Mikrofon über die OpenAI Realtime API. Nur bei OpenAI verfügbar — lokale Server (LM Studio, Ollama) bieten sie nicht an."
      >
        <div className="mb-4">
          <Toggle
            label="Sprachmodus aktivieren"
            hint="Blendet den Mikrofon-Knopf im Assistenz-Panel ein."
            checked={draft.ai.realtime.enabled}
            onChange={(enabled) =>
              update({
                ai: {
                  ...draft.ai,
                  realtime: { ...draft.ai.realtime, enabled },
                },
              })
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Realtime-Modell">
            <input
              value={draft.ai.realtime.model}
              onChange={(event) =>
                update({
                  ai: {
                    ...draft.ai,
                    realtime: {
                      ...draft.ai.realtime,
                      model: event.target.value,
                    },
                  },
                })
              }
              spellCheck={false}
              className="field font-mono text-2xs"
            />
          </Field>

          <Field label="Stimme">
            <select
              value={draft.ai.realtime.voice}
              onChange={(event) =>
                update({
                  ai: {
                    ...draft.ai,
                    realtime: {
                      ...draft.ai.realtime,
                      voice: event.target.value,
                    },
                  },
                })
              }
              className="field"
            >
              {VOICES.map((voice) => (
                <option key={voice} value={voice} className="bg-surface-700">
                  {voice}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Transkriptionsmodell"
            hint="Wandelt die eigene Sprache in Text für den Verlauf."
          >
            <input
              value={draft.ai.realtime.transcriptionModel}
              onChange={(event) =>
                update({
                  ai: {
                    ...draft.ai,
                    realtime: {
                      ...draft.ai.realtime,
                      transcriptionModel: event.target.value,
                    },
                  },
                })
              }
              spellCheck={false}
              className="field font-mono text-2xs"
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <div className="w-64">
            <TestButton label="Sprachmodus testen" run={api.testRealtime} />
          </div>
          <p className="max-w-lg text-3xs leading-relaxed text-zinc-600">
            <span className="text-signal-warn">Wichtig:</span> Ein ChatGPT-Plus-
            oder Pro-Abo schaltet die API{" "}
            <span className="text-zinc-400">nicht</span> frei. Der Sprachmodus
            braucht einen API-Key von platform.openai.com mit Guthaben; die
            Abrechnung läuft getrennt vom Abo. Das Mikrofon funktioniert nur,
            wenn die Seite über <span className="digits">localhost</span> oder
            HTTPS geöffnet ist.
          </p>
        </div>
      </Section>
    </>
  );
}

/** Von der Realtime-API angebotene Stimmen. */
const VOICES = [
  "alloy",
  "ash",
  "ballad",
  "cedar",
  "coral",
  "echo",
  "marin",
  "sage",
  "shimmer",
  "verse",
];

/* -------------------------------------------------------------------------- */
/* Darstellung                                                                 */
/* -------------------------------------------------------------------------- */

/** Fenster, die eine eigene Bewegung tragen können. */
const WINDOW_LABELS: Array<{ id: WindowId; label: string }> = [
  { id: "agenda", label: "Heute" },
  { id: "calendar", label: "Kalender" },
  { id: "weather", label: "Wetter" },
  { id: "trash", label: "Müllabholung" },
  { id: "smarthome", label: "Smart Home" },
  { id: "sensors", label: "Zuhause" },
  { id: "assistant", label: "Assistent" },
  { id: "timer", label: "Timer" },
  { id: "lists", label: "Liste" },
];

const BACKDROP_STYLES: BackdropStyle[] = [
  "none",
  "timeline",
  "grid",
  "drift",
  "breathe",
  "pulse",
  "sweep",
  "orbit",
  "ring",
  "rain",
  "embers",
];

/** 0–23 für die Stundenauswahl der Nachtabsenkung. */
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/*
 * Voreinstellung, auf die „Effekte" beim Wiedereinschalten zurückfällt.
 * Die zuvor gewählten Stile werden bewusst nicht gemerkt: Das wäre ein
 * zweiter Satz Konfiguration, der still veralten kann.
 */
const STANDARD_BACKDROPS: Record<WindowId, BackdropStyle> = {
  agenda: "timeline",
  calendar: "grid",
  weather: "drift",
  trash: "breathe",
  smarthome: "pulse",
  sensors: "sweep",
  assistant: "orbit",
  timer: "ring",
  lists: "grid",
  settings: "none",
};

function AppearanceSettings({ draft, update }: PaneProps) {
  const appearance = draft.appearance;
  const night = appearance.night;
  const set = (patch: Partial<typeof appearance>) =>
    update({ appearance: { ...appearance, ...patch } });

  /*
   * Sammelschalter. Ohne ihn müsste man Bewegung an fünf Stellen abschalten:
   * CSS-Animationen, neun Fenster-Hintergründe, den Sekundenticker der Uhr,
   * die Diashow und die Übergänge. Auf einem schwachen Panel ist das der
   * wichtigste Regler überhaupt — er halbiert die Rechenlast.
   */
  const effekteAn =
    !appearance.reducedMotion ||
    Object.values(appearance.windowBackdrops).some((stil) => stil !== "none") ||
    draft.idle.slideshow.enabled;

  const setzeEffekte = (an: boolean) => {
    const backdrops = Object.fromEntries(
      (Object.keys(appearance.windowBackdrops) as WindowId[]).map((id) => [
        id,
        an ? (STANDARD_BACKDROPS[id] ?? "drift") : "none",
      ]),
    ) as Record<WindowId, BackdropStyle>;

    update({
      appearance: {
        ...appearance,
        reducedMotion: !an,
        showSeconds: an ? appearance.showSeconds : false,
        windowBackdrops: backdrops,
      },
      idle: {
        ...draft.idle,
        slideshow: { ...draft.idle.slideshow, enabled: an },
      },
    });
  };
  const setNight = (patch: Partial<typeof night>) =>
    update({ appearance: { ...appearance, night: { ...night, ...patch } } });

  return (
    <>
      <Section
        title="Effekte"
        description="Sammelschalter für alles, was sich bewegt. Aus heißt: keine Animationen, keine Hintergrundbewegung in den Fenstern, kein Sekundenticker, keine Diashow. Halbiert die Rechenlast — auf einem schwachen Panel der wirksamste Regler."
      >
        <Toggle
          label="Effekte"
          hint={
            effekteAn
              ? "Alles an. Zum Abschalten umlegen."
              : "Alles aus. Der Einbrennschutz läuft davon unabhängig weiter."
          }
          checked={effekteAn}
          onChange={setzeEffekte}
        />
      </Section>

      <Section
        title="Anordnung"
        description="Welche Panels das Dashboard zeigt und wo sie stehen — zehn Vorlagen oder selbst zusammengestellt."
      >
        <LayoutEditor
          layout={draft.layout}
          onChange={(layout) => update({ layout })}
        />
      </Section>

      <Section
        title="Design"
        description={
          appearance.skin === "default"
            ? "Hell oder dunkel. „Automatisch“ folgt dem Sonnenstand deines Ortes — hell ab Sonnenaufgang, dunkel ab Sonnenuntergang. Die Zeiten kommen aus der Wettervorhersage."
            : "Von der Design-Richtung fest vorgegeben — siehe „Farben & Schrift“ unten."
        }
      >
        <SegmentedControl<ColorScheme>
          value={appearance.colorScheme}
          onChange={(colorScheme) => set({ colorScheme })}
          disabled={appearance.skin !== "default"}
          options={[
            { value: "dark", label: "Dunkel" },
            { value: "light", label: "Hell" },
            { value: "auto", label: "Automatisch" },
          ]}
        />
      </Section>

      <Section
        title="Farben & Schrift"
        description="Fünfzehn Design-Richtungen als fertige Gesamtpakete, oder darunter acht Akzentfarben plus eigene Farbe und sechs Schriftarten einzeln kombiniert."
      >
        <ThemeEditor
          themeMode={appearance.themeMode}
          customAccent={appearance.customAccent}
          fontPairing={appearance.fontPairing}
          skin={appearance.skin}
          onChange={(patch) => set(patch)}
        />
      </Section>

      <Section
        title="Cindralux-Hintergrund"
        description="Eigene Dateien in assets/cindralux/ ablegen und in src/theme/tokens.js ergänzen."
      >
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {backgrounds.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => set({ background: option.file })}
              className={cx(
                "touchable relative h-24 overflow-hidden rounded-[3px] border",
                appearance.background === option.file
                  ? "border-accent/60 shadow-glow"
                  : "border-white/[0.08]",
              )}
            >
              {option.file ? (
                <img
                  src={`/cindralux/${option.file}`}
                  alt=""
                  className="absolute inset-0 h-full w-full bg-surface-900 object-cover"
                  style={{ filter: "brightness(2.6) saturate(1.2)" }}
                />
              ) : (
                <span className="absolute inset-0 bg-surface-800" />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2.5 py-1.5 text-left text-3xs uppercase tracking-wide2 text-zinc-300">
                {option.label}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 max-w-md">
          <Field
            label={`Deckkraft — ${Math.round(appearance.backgroundOpacity * 100)} %`}
          >
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(appearance.backgroundOpacity * 100)}
              onChange={(event) =>
                set({ backgroundOpacity: Number(event.target.value) / 100 })
              }
              className="slider"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Bewegung je Fenster"
        description="Jedes Fenster kann eine eigene, ruhige Hintergrundbewegung tragen — so erkennt man auf einen Blick, wo man ist."
      >
        <div className="space-y-2.5">
          {WINDOW_LABELS.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center gap-3 rounded-[3px] border border-white/[0.07] bg-white/[0.015] p-3"
            >
              <span className="w-36 shrink-0 text-2xs text-zinc-200">
                {entry.label}
              </span>

              <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {BACKDROP_STYLES.map((style) => {
                  const active = appearance.windowBackdrops[entry.id] === style;
                  return (
                    <button
                      key={style}
                      type="button"
                      onClick={() =>
                        set({
                          windowBackdrops: {
                            ...appearance.windowBackdrops,
                            [entry.id]: style,
                          },
                        })
                      }
                      title={BACKDROP_LABELS[style]}
                      className={cx(
                        "touchable relative h-14 w-20 min-h-0 overflow-hidden rounded-[3px] border",
                        active
                          ? "border-accent/60 shadow-glow"
                          : "border-white/[0.08] opacity-60",
                      )}
                    >
                      <span className="absolute inset-0 bg-surface-900" />
                      {style !== "none" && <PanelBackdrop variant={style} />}
                      <span
                        className={cx(
                          "absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-3xs",
                          active ? "text-accent-soft" : "text-zinc-500",
                        )}
                      >
                        {BACKDROP_LABELS[style]}
                      </span>
                    </button>
                  );
                })}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Anzeige">
        <div className="grid gap-2.5 lg:grid-cols-2">
          <Toggle
            label="Sekunden anzeigen"
            hint="Zeigt die Sekunden neben der großen Uhr."
            checked={appearance.showSeconds}
            onChange={(showSeconds) => set({ showSeconds })}
          />
          <Toggle
            label="Animationen reduzieren"
            hint="Empfohlen auf schwacher Pi-Hardware."
            checked={appearance.reducedMotion}
            onChange={(reducedMotion) => set({ reducedMotion })}
          />
          <Toggle
            label="Einbrennschutz"
            hint="Verschiebt das Bild sehr langsam um wenige Pixel. Ein statisches Panel brennt sich sonst ins Display ein."
            checked={appearance.burnInProtection}
            onChange={(burnInProtection) => set({ burnInProtection })}
          />
        </div>

        <Field
          label="Bildschirmtastatur"
          hint="Öffnet sich beim Antippen eines Eingabefelds. Sie legt sich nie über den Inhalt — der Bereich darüber wird kleiner. „Automatisch“ blendet sie nur ein, solange keine echte Tastatur angeschlossen ist."
        >
          <SegmentedControl
            value={appearance.onScreenKeyboard}
            onChange={(onScreenKeyboard) => set({ onScreenKeyboard })}
            options={[
              { value: "auto", label: "Automatisch" },
              { value: "always", label: "Immer" },
              { value: "off", label: "Aus" },
            ]}
          />
          <InputDeviceHint />
        </Field>
      </Section>

      <Section
        title="Nachtabsenkung"
        description="Dunkelt das Panel nachts ab. Jede Berührung weckt es kurz auf."
      >
        <div className="mb-4">
          <Toggle
            label="Nachts abdunkeln"
            checked={night.enabled}
            onChange={(enabled) => setNight({ enabled })}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <Field label="Ab Uhrzeit">
            <select
              value={night.startHour}
              onChange={(event) =>
                setNight({ startHour: Number(event.target.value) })
              }
              className="field digits"
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour} className="bg-surface-700">
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </Field>

          <Field label="Bis Uhrzeit">
            <select
              value={night.endHour}
              onChange={(event) =>
                setNight({ endHour: Number(event.target.value) })
              }
              className="field digits"
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour} className="bg-surface-700">
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={`Resthelligkeit — ${Math.round(night.dimLevel * 100)} %`}
          >
            <input
              type="range"
              min={5}
              max={100}
              value={Math.round(night.dimLevel * 100)}
              onChange={(event) =>
                setNight({ dimLevel: Number(event.target.value) / 100 })
              }
              className="slider"
            />
          </Field>

          <Field label="Aufwachen für (Sekunden)">
            <input
              type="number"
              min={5}
              max={600}
              value={night.wakeSeconds}
              onChange={(event) =>
                setNight({
                  wakeSeconds: Math.max(5, Number(event.target.value) || 45),
                })
              }
              className="field digits"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Toggle
            label="Nachts nur die Uhr zeigen"
            hint="Blendet das Dashboard aus und zeigt groß Uhrzeit, Datum und eine anstehende Müllabholung."
            checked={night.clockOnly}
            onChange={(clockOnly) => setNight({ clockOnly })}
          />
        </div>

        {/* Text in ein einziges Kind: sonst würde das eingebettete <span>
            im Flex-Container zu einer eigenen Spalte. */}
        <div className="mt-4 flex items-start gap-2.5 rounded-[3px] border border-white/[0.07] bg-white/[0.015] p-3.5">
          <Moon
            size={14}
            strokeWidth={1.7}
            className="mt-px shrink-0 text-zinc-600"
          />
          <p className="text-3xs leading-relaxed text-zinc-500">
            Die Absenkung dunkelt das Bild ab — die Hintergrundbeleuchtung lässt
            sich aus dem Browser nicht steuern. Für echtes Abschalten des
            Displays braucht es auf dem Pi DPMS oder{" "}
            <span className="digits">vcgencmd display_power</span>; die README
            beschreibt das.
          </p>
        </div>
      </Section>

      <Section title="Assistent" description="Hinweis zur Datenhaltung.">
        <p className="flex items-start gap-2.5 rounded-[3px] border border-white/[0.07] bg-white/[0.015] p-3.5 text-3xs leading-relaxed text-zinc-500">
          <Bot
            size={15}
            strokeWidth={1.6}
            className="mt-px shrink-0 text-zinc-600"
          />
          Ohne API-Key verlässt keine Anfrage das Gerät — der Assistent
          antwortet dann aus Kalender, Wetter und Müllplan. Mit Key gehen
          Kontextdaten an den eingetragenen Server.
        </p>
      </Section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Ruhemodus und Diashow                                                       */
/* -------------------------------------------------------------------------- */

function IdleSettings({ draft, update }: PaneProps) {
  const idle = draft.idle;
  const show = draft.idle.slideshow;

  const setIdle = (patch: Partial<typeof idle>) =>
    update({ idle: { ...idle, ...patch } });
  const setShow = (patch: Partial<typeof show>) =>
    update({ idle: { ...idle, slideshow: { ...show, ...patch } } });

  return (
    <>
      <Section
        title="Ruhemodus"
        description="Wird das Panel eine Weile nicht bedient, bleibt nur das Wesentliche stehen. Jede Berührung holt das Dashboard zurück."
      >
        <div className="mb-4">
          <Toggle
            label="Ruhemodus aktivieren"
            checked={idle.enabled}
            onChange={(enabled) => setIdle({ enabled })}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field
            label="Nach Sekunden ohne Bedienung"
            hint="Mindestens 15 Sekunden. Zwei Minuten haben sich als angenehm erwiesen."
          >
            <input
              type="number"
              min={15}
              max={3600}
              value={idle.afterSeconds}
              onChange={(event) =>
                setIdle({
                  afterSeconds: Math.max(15, Number(event.target.value) || 120),
                })
              }
              className="field digits w-44"
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-2.5 lg:grid-cols-3">
          <Toggle
            label="Uhrzeit zeigen"
            checked={idle.showClock}
            onChange={(showClock) => setIdle({ showClock })}
          />
          <Toggle
            label="Wetter zeigen"
            checked={idle.showWeather}
            onChange={(showWeather) => setIdle({ showWeather })}
          />
          <Toggle
            label="Termine des Tages zeigen"
            checked={idle.showAgenda}
            onChange={(showAgenda) => setIdle({ showAgenda })}
          />
        </div>
      </Section>

      <Section
        title="Diashow"
        description="Läuft im Ruhemodus hinter Uhr und Wetter."
      >
        <div className="mb-4 grid gap-2.5 lg:grid-cols-2">
          <Toggle
            label="Diashow aktivieren"
            checked={show.enabled}
            onChange={(enabled) => setShow({ enabled })}
          />
          <Toggle
            label="Bei jedem Wechsel anderer Effekt"
            hint="Übergeht die feste Auswahl unten."
            checked={show.randomTransition}
            onChange={(randomTransition) => setShow({ randomTransition })}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Sekunden je Bild">
            <input
              type="number"
              min={4}
              max={600}
              value={show.intervalSeconds}
              onChange={(event) =>
                setShow({
                  intervalSeconds: Math.max(4, Number(event.target.value) || 20),
                })
              }
              className="field digits w-40"
            />
          </Field>

          <Field
            label="Reihenfolge"
            hint={
              show.order === "person"
                ? "Personenmarkierung wird bei den Bildern unten vergeben. Unmarkierte laufen zuletzt."
                : show.order === "date"
                  ? "Aufnahme- bzw. Dateidatum, älteste zuerst."
                  : "Bei jedem Start des Ruhemodus neu gemischt."
            }
          >
            <SegmentedControl<SlideshowOrder>
              value={show.order}
              onChange={(order) => setShow({ order })}
              options={[
                { value: "mix", label: "Mix" },
                { value: "date", label: "Datum" },
                { value: "person", label: "Person" },
              ]}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Übergangseffekt"
        description="Zwanzig Effekte in einem Stil — ruhig und lang, ohne Sprünge. Jede Kachel läuft als Vorschau."
      >
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
          {TRANSITIONS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setShow({ transition: entry.id })}
              className={cx(
                "touchable overflow-hidden rounded-[3px] border text-left",
                show.transition === entry.id
                  ? "border-accent/60 shadow-glow"
                  : "border-white/[0.08]",
              )}
            >
              <TransitionPreview
                transition={entry.id}
                className="h-20 w-full"
              />
              <span className="block px-3 py-2">
                <span
                  className={cx(
                    "block truncate text-2xs",
                    show.transition === entry.id
                      ? "text-accent-soft"
                      : "text-zinc-200",
                  )}
                >
                  {entry.label}
                </span>
                <span className="mt-1 block truncate text-3xs text-zinc-600">
                  {entry.hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Bilder"
        description="Welche Bilder die Diashow zeigt. Ohne Auswahl laufen alle."
      >
        <PhotoPicker
          localDir={draft.photos.localDir}
          selected={draft.photos.selected}
          onChangeDir={(localDir) =>
            update({ photos: { ...draft.photos, localDir } })
          }
          onChangeSelection={(selected) =>
            update({ photos: { ...draft.photos, selected } })
          }
        />
      </Section>
    </>
  );
}
