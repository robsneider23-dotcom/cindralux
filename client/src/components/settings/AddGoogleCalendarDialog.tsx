import {
  AlertTriangle,
  Check,
  ExternalLink,
  Loader2,
  ShieldAlert,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { CalendarValidation, PublicCalendarSource } from "@shared/types";

/** Wie in den Einstellungen: `url` trägt die frisch eingegebene Adresse. */
type DraftCalendar = PublicCalendarSource & { url?: string };
import { api } from "@/lib/api";
import { calendarPalette } from "@/theme/tokens.js";
import { cx, uid } from "@/lib/utils";
import { ColorPicker, Field } from "./SettingsControls";
import { Portal } from "../Portal";

/** Klickpfad in Google Calendar — bewusst wörtlich, damit man ihn nachvollziehen kann. */
const STEPS = [
  "Am Computer calendar.google.com öffnen (in der Handy-App gibt es die Adresse nicht).",
  'Links in der Kalenderliste auf die drei Punkte neben dem Kalender → „Einstellungen und Freigabe".',
  'Ganz nach unten scrollen bis zum Abschnitt „Kalender integrieren".',
  'Beim Feld „Privatadresse im iCal-Format" auf das Kopiersymbol tippen.',
  "Die Adresse hier unten einfügen und prüfen lassen.",
];

interface Props {
  /** Bereits vergebene Konten — als Vorschläge in der Auswahl. */
  knownAccounts: string[];
  /** Farben, die schon in Benutzung sind — für einen sinnvollen Vorschlag. */
  usedColors: string[];
  onCancel: () => void;
  onAdd: (source: DraftCalendar) => void;
}

/**
 * Geführtes Hinzufügen eines Google-Kalenders über die private iCal-Adresse.
 *
 * Der Dialog prüft die Adresse serverseitig, bevor er sie übernimmt: so merkt
 * man sofort, ob der Feed erreichbar ist, und Name und Terminzahl kommen direkt
 * aus dem Kalender statt aus einem Tippfeld.
 */
export function AddGoogleCalendarDialog({
  knownAccounts,
  usedColors,
  onCancel,
  onAdd,
}: Props) {
  const [account, setAccount] = useState(knownAccounts[0] ?? "");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState(
    calendarPalette.find((entry) => !usedColors.includes(entry)) ??
      calendarPalette[0] ??
      "#ff5a1f",
  );
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CalendarValidation | null>(null);

  // Eine geänderte Adresse macht das vorherige Prüfergebnis ungültig.
  useEffect(() => {
    setResult(null);
  }, [url]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const check = async () => {
    setChecking(true);
    try {
      const validation = await api.validateCalendar(url);
      setResult(validation);
      // Namen aus dem Feed übernehmen, sofern der Nutzer noch keinen gesetzt hat.
      if (validation.ok && validation.name && !name.trim())
        setName(validation.name);
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setChecking(false);
    }
  };

  const submit = () => {
    if (!result?.ok) return;
    onAdd({
      // Adresse wurde gerade geprüft und wird mitgeschickt.
      hasUrl: true,
      id: uid("cal"),
      name: name.trim() || result.name || "Google Kalender",
      color,
      url: url.trim(),
      enabled: true,
      account: account.trim() || undefined,
      provider: result.provider ?? "google",
    });
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
        <div className="panel scanlines noise flex max-h-full w-full max-w-4xl flex-col bg-surface-800">
          <header className="panel-head">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-3.5 w-[2px] shrink-0 rounded-full"
                style={{
                  background: "rgb(var(--accent))",
                  boxShadow: "0 0 10px rgb(var(--accent))",
                }}
              />
              <h2 className="label text-zinc-300">
                Google-Kalender hinzufügen
              </h2>
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

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {/* Anleitung */}
            <ol className="mb-6 space-y-2.5">
              {STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="digits mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/[0.08] text-3xs text-accent-soft">
                    {index + 1}
                  </span>
                  <span className="text-2xs leading-relaxed text-zinc-400">
                    {step}
                  </span>
                </li>
              ))}
            </ol>

            <a
              href="https://calendar.google.com/calendar/u/0/r/settings"
              target="_blank"
              rel="noreferrer"
              className="btn mb-6 inline-flex min-h-[46px] w-auto px-4"
            >
              <ExternalLink size={14} strokeWidth={1.8} />
              Google-Kalender-Einstellungen öffnen
            </a>

            <div className="grid gap-5 lg:grid-cols-2">
              <Field
                label="Konto"
                hint="Nur zur Gruppierung im Dashboard, z. B. die E-Mail-Adresse. Beliebig wählbar."
              >
                <input
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                  placeholder="marcus@gmail.com"
                  spellCheck={false}
                  autoCapitalize="off"
                  list="cindralux-known-accounts"
                  className="field"
                />
                <datalist id="cindralux-known-accounts">
                  {knownAccounts.map((entry) => (
                    <option key={entry} value={entry} />
                  ))}
                </datalist>
              </Field>

              <Field
                label="Anzeigename"
                hint="Wird nach der Prüfung automatisch aus dem Kalender übernommen."
              >
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="wird automatisch gefüllt"
                  className="field"
                />
              </Field>
            </div>

            <div className="mt-5">
              <Field label="Privatadresse im iCal-Format">
                <div className="flex gap-2">
                  <input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics"
                    spellCheck={false}
                    autoCapitalize="off"
                    className="field min-w-0 flex-1 font-mono text-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => void check()}
                    disabled={checking || !url.trim()}
                    className="btn min-h-[52px] shrink-0 px-5"
                  >
                    {checking ? (
                      <Loader2
                        size={15}
                        strokeWidth={1.8}
                        className="animate-spin"
                      />
                    ) : null}
                    Prüfen
                  </button>
                </div>
              </Field>
            </div>

            {/* Prüfergebnis */}
            {result && (
              <div
                className={cx(
                  "mt-4 flex items-start gap-3 rounded-[3px] border px-4 py-3",
                  result.ok
                    ? "border-signal-ok/30 bg-signal-ok/[0.08]"
                    : "border-signal-err/30 bg-signal-err/[0.08]",
                )}
              >
                {result.ok ? (
                  <Check
                    size={16}
                    strokeWidth={2.2}
                    className="mt-px shrink-0 text-signal-ok"
                  />
                ) : (
                  <AlertTriangle
                    size={16}
                    strokeWidth={1.9}
                    className="mt-px shrink-0 text-signal-err"
                  />
                )}
                <div className="min-w-0">
                  <p
                    className={cx(
                      "text-2xs leading-relaxed",
                      result.ok ? "text-signal-ok/90" : "text-signal-err/90",
                    )}
                  >
                    {result.message}
                  </p>
                  {result.ok && result.name && (
                    <p className="mt-1 text-3xs text-zinc-500">
                      Kalender:{" "}
                      <span className="text-zinc-300">{result.name}</span>
                      {result.timezone && ` · ${result.timezone}`}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6">
              <span className="label mb-2 block">Farbe</span>
              <ColorPicker
                value={color}
                palette={calendarPalette}
                onChange={setColor}
              />
            </div>

            {/* Zwei Dinge, die man vorher wissen sollte */}
            <div className="mt-6 space-y-2.5">
              <p className="flex items-start gap-2.5 rounded-[3px] border border-signal-warn/25 bg-signal-warn/[0.06] px-3.5 py-3 text-3xs leading-relaxed text-zinc-400">
                <ShieldAlert
                  size={14}
                  strokeWidth={1.8}
                  className="mt-px shrink-0 text-signal-warn"
                />
                <span>
                  Die Privatadresse wirkt wie ein Passwort: Wer sie kennt, kann
                  deinen Kalender lesen. Sie wird nur lokal in{" "}
                  <span className="digits">data/config.json</span> gespeichert
                  und verlässt dieses Gerät nicht. In Google lässt sie sich
                  jederzeit zurücksetzen.
                </span>
              </p>
              <p className="flex items-start gap-2.5 rounded-[3px] border border-white/[0.07] bg-white/[0.015] px-3.5 py-3 text-3xs leading-relaxed text-zinc-500">
                <AlertTriangle
                  size={14}
                  strokeWidth={1.8}
                  className="mt-px shrink-0 text-zinc-600"
                />
                <span>
                  Google aktualisiert iCal-Feeds nur träge — neue oder
                  verschobene Termine können bis zu 24 Stunden brauchen, bis sie
                  hier auftauchen. Das ist eine Grenze von Google, nicht des
                  Dashboards.
                </span>
              </p>
            </div>
          </div>

          <footer className="flex shrink-0 justify-end gap-2 border-t border-white/[0.055] p-3">
            <button
              type="button"
              onClick={onCancel}
              className="btn min-h-[50px] px-5"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!result?.ok}
              className="btn btn-accent min-h-[50px] px-6"
            >
              <Check size={16} strokeWidth={2.2} />
              Kalender hinzufügen
            </button>
          </footer>
        </div>
      </div>
    </Portal>
  );
}
