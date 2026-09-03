import {
  Check,
  ExternalLink,
  Link2Off,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type {
  GoogleCalendarEntry,
  GoogleStatus,
  PublicCalendarSource,
} from "@shared/types";

/** Wie in den Einstellungen: `url` nur beim Schreiben vorhanden. */
type DraftCalendar = PublicCalendarSource & { url?: string };
import { api } from "@/lib/api";
import { calendarPalette } from "@/theme/tokens.js";
import { cx, uid } from "@/lib/utils";
import { Field } from "./SettingsControls";

/**
 * Google-Konto verbinden und Kalender übernehmen.
 *
 * Gegenüber der ICS-Adresse: nahezu live statt bis zu 24 Stunden Verzögerung,
 * und Google löst Serientermine selbst auf. Preis dafür ist ein einmaliges
 * Google-Cloud-Projekt — die Anleitung steht in docs/google-kalender.md.
 */
export function GoogleCalendarSetup({
  clientId,
  hasClientSecret,
  sources,
  onChangeCredentials,
  onAddSource,
  onRemoveSource,
}: {
  clientId: string;
  hasClientSecret: boolean;
  sources: PublicCalendarSource[];
  onChangeCredentials: (patch: {
    clientId?: string;
    clientSecret?: string;
  }) => void;
  onAddSource: (source: DraftCalendar) => void;
  onRemoveSource: (googleCalendarId: string) => void;
}) {
  const [status, setStatus] = useState<
    (GoogleStatus & { redirectUri: string }) | null
  >(null);
  const [calendars, setCalendars] = useState<GoogleCalendarEntry[] | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next = await api.googleStatus();
      setStatus(next);
      if (next.connected) setCalendars(await api.googleCalendars());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Zustimmungsdialog öffnen und danach den Zustand neu holen.
   *
   * Google leitet auf diesen Server zurück; das Dashboard bekommt davon nichts
   * mit. Deshalb wird nach dem Schließen des Fensters gepollt.
   */
  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.googleAuthUrl();
      const win = window.open(url, "_blank", "width=520,height=680");
      if (!win) {
        setError(
          "Der Browser hat das Fenster blockiert. Popups für diese Seite erlauben.",
        );
        return;
      }

      // Alle zwei Sekunden nachsehen, bis die Verbindung steht (max. 3 Minuten).
      const started = Date.now();
      const poll = window.setInterval(async () => {
        const next = await api.googleStatus().catch(() => null);
        if (next?.connected || Date.now() - started > 180_000) {
          window.clearInterval(poll);
          setBusy(false);
          await refresh();
        }
      }, 2000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    await api.googleDisconnect().catch(() => undefined);
    setCalendars(null);
    await refresh();
    setBusy(false);
  };

  const toggleCalendar = (entry: GoogleCalendarEntry) => {
    if (entry.inUse) {
      onRemoveSource(entry.id);
    } else {
      const used = sources.map((source) => source.color);
      const color =
        entry.backgroundColor ??
        calendarPalette.find((option) => !used.includes(option)) ??
        calendarPalette[0] ??
        "#ff5a1f";

      onAddSource({
        id: uid("gcal"),
        name: entry.summary,
        color,
        hasUrl: false,
        enabled: true,
        provider: "google-api",
        googleCalendarId: entry.id,
        account: status?.account || undefined,
      });
    }

    // Optimistisch umschalten; der nächste Abruf bestätigt es.
    setCalendars(
      (prev) =>
        prev?.map((item) =>
          item.id === entry.id ? { ...item, inUse: !item.inUse } : item,
        ) ?? null,
    );
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field
          label="Client-ID"
          hint="Aus der Google Cloud Console, endet auf .apps.googleusercontent.com"
        >
          <input
            value={clientId}
            onChange={(event) =>
              onChangeCredentials({ clientId: event.target.value })
            }
            placeholder="…apps.googleusercontent.com"
            spellCheck={false}
            autoCapitalize="off"
            className="field font-mono text-2xs"
          />
        </Field>

        <Field
          label="Client-Secret"
          hint={
            hasClientSecret
              ? "Ein Secret ist hinterlegt. Leer lassen, um es unverändert zu übernehmen."
              : "Noch kein Secret hinterlegt."
          }
        >
          <input
            type="password"
            value={secret}
            onChange={(event) => {
              setSecret(event.target.value);
              onChangeCredentials({ clientSecret: event.target.value });
            }}
            placeholder={
              hasClientSecret ? "•••••••••• (gespeichert)" : "GOCSPX-…"
            }
            spellCheck={false}
            className="field font-mono text-2xs"
          />
        </Field>
      </div>

      {/* Weiterleitungsadresse — muss in Google eingetragen sein */}
      {status?.redirectUri && (
        <p className="mt-3 flex items-start gap-2.5 rounded-[3px] border border-white/[0.07] bg-white/[0.015] px-3.5 py-3">
          <ShieldCheck
            size={14}
            strokeWidth={1.7}
            className="mt-px shrink-0 text-zinc-600"
          />
          <span className="text-3xs leading-relaxed text-zinc-500">
            Diese Weiterleitungs-URI muss beim OAuth-Client hinterlegt sein:{" "}
            <span className="digits text-zinc-300">{status.redirectUri}</span>
          </span>
        </p>
      )}

      {/* Verbindung */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {status?.connected ? (
          <>
            <span className="flex items-center gap-2 rounded-[3px] border border-signal-ok/30 bg-signal-ok/[0.08] px-3.5 py-2.5 text-2xs text-signal-ok">
              <Check size={15} strokeWidth={2.2} />
              Verbunden{status.account ? ` · ${status.account}` : ""}
            </span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="btn min-h-[48px] px-4"
            >
              <RefreshCw size={15} strokeWidth={1.7} />
              Kalender neu laden
            </button>
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={busy}
              className="btn min-h-[48px] px-4"
            >
              <Link2Off size={15} strokeWidth={1.7} />
              Trennen
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void connect()}
            disabled={busy || !clientId.trim() || !hasClientSecret}
            className="btn btn-accent min-h-[48px] px-5"
          >
            {busy ? (
              <Loader2 size={15} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <ExternalLink size={15} strokeWidth={1.7} />
            )}
            {busy ? "Warte auf Zustimmung …" : "Mit Google verbinden"}
          </button>
        )}
      </div>

      {(error || status?.message) && !status?.connected && (
        <p className="mt-3 text-3xs leading-relaxed text-zinc-500">
          {error ?? status?.message}
        </p>
      )}

      {/* Kalender des Kontos */}
      {status?.connected && calendars && (
        <div className="mt-5">
          <span className="label mb-2.5 block">Kalender dieses Kontos</span>
          <div className="space-y-1">
            {calendars.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => toggleCalendar(entry)}
                className={cx(
                  "touchable flex w-full items-center gap-3 rounded-[3px] border px-3.5 text-left",
                  entry.inUse
                    ? "border-accent/40 bg-accent/[0.08]"
                    : "border-white/[0.07] active:bg-white/[0.035]",
                )}
              >
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ background: entry.backgroundColor ?? "#71717a" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-200">
                    {entry.summary}
                    {entry.primary && (
                      <span className="ml-2 text-3xs uppercase tracking-wide2 text-zinc-600">
                        Haupt
                      </span>
                    )}
                  </span>
                  <span className="digits block truncate text-3xs text-zinc-600">
                    {entry.id}
                  </span>
                </span>
                <span
                  className={cx(
                    "flex shrink-0 items-center gap-1.5 text-3xs uppercase tracking-wide2",
                    entry.inUse ? "text-accent-soft" : "text-zinc-500",
                  )}
                >
                  {entry.inUse ? (
                    <>
                      <Check size={14} strokeWidth={2.2} />
                      im Dashboard
                    </>
                  ) : (
                    <>
                      <Plus size={14} strokeWidth={2.2} />
                      hinzufügen
                    </>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
