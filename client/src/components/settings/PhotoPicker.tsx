import { Check, CloudDownload, FolderOpen, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { GoogleStatus, PhotoLibrary } from '@shared/types';
import { api } from '@/lib/api';
import { cx } from '@/lib/utils';
import { Field } from './SettingsControls';

/**
 * Bildauswahl für die Diashow.
 *
 * Zeigt alle Bilder des Ordners als Miniaturen; ein Tipp nimmt eines auf oder
 * heraus. Ohne jede Auswahl laufen alle — sonst bliebe die Diashow leer,
 * solange niemand etwas angehakt hat.
 *
 * Google Fotos kommen ueber denselben Ordner dazu: "Google Fotos auswaehlen"
 * oeffnet Googles eigenes Auswahlfenster (Picker API — Google erlaubt seit
 * 2025 keinen automatischen Zugriff auf die ganze Mediathek mehr), das
 * Dashboard laedt die dort gewaehlten Bilder herunter und legt sie als
 * normale Dateien in den Ordner. Ab dann laufen sie hier wie lokale Bilder
 * mit — inklusive der Auswahl, welche die Diashow zeigen soll.
 */
export function PhotoPicker({
  localDir,
  selected,
  onChangeDir,
  onChangeSelection,
}: {
  localDir: string;
  selected: string[];
  onChangeDir: (dir: string) => void;
  onChangeSelection: (ids: string[]) => void;
}) {
  const [library, setLibrary] = useState<PhotoLibrary | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setLibrary(await api.photoLibrary());
    } catch {
      setLibrary(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
    api.googleStatus().then(setGoogleStatus).catch(() => setGoogleStatus(null));
  }, [load]);

  /**
   * Picker-Fenster oeffnen und danach pollen, bis die Auswahl steht.
   *
   * Google gibt kein Signal an die Seite, die das Fenster geoeffnet hat —
   * genau wie beim Google-Kalender-Verbinden bleibt nur das Nachfragen in
   * dem Abstand, den die Sitzungsantwort selbst vorschlaegt.
   */
  const pickFromGoogle = async () => {
    setGoogleBusy(true);
    setGoogleError(null);
    try {
      const session = await api.googlePhotosStartSession();
      const win = window.open(session.pickerUri, '_blank', 'width=560,height=760');
      if (!win) {
        setGoogleError('Der Browser hat das Fenster blockiert. Popups für diese Seite erlauben.');
        setGoogleBusy(false);
        return;
      }

      const startedAt = Date.now();
      // Erst warten, dann fragen — direkt nach dem Öffnen des Fensters hat der
      // Nutzer ohnehin noch nichts ausgewaehlt.
      const poll = (waitMs: number): void => {
        window.setTimeout(() => {
          void (async () => {
            if (Date.now() - startedAt > 10 * 60_000) {
              setGoogleError('Zeitüberschreitung — wurde im Fenster etwas ausgewählt und bestätigt?');
              setGoogleBusy(false);
              return;
            }
            try {
              const status = await api.googlePhotosSessionStatus(session.sessionId);
              if (status.ready) {
                setLibrary(await api.googlePhotosImport(session.sessionId));
                setGoogleBusy(false);
                return;
              }
              poll(status.pollIntervalMs);
            } catch (cause) {
              setGoogleError(cause instanceof Error ? cause.message : String(cause));
              setGoogleBusy(false);
            }
          })();
        }, waitMs);
      };
      poll(session.pollIntervalMs);
    } catch (cause) {
      setGoogleError(cause instanceof Error ? cause.message : String(cause));
      setGoogleBusy(false);
    }
  };

  const toggle = (id: string) => {
    const all = library?.photos.map((photo) => photo.id) ?? [];
    // Aus "alle" wird beim ersten Abwählen eine echte Liste.
    const base = selected.length === 0 ? all : selected;
    onChangeSelection(
      base.includes(id) ? base.filter((entry) => entry !== id) : [...base, id],
    );
  };

  const isOn = (id: string) => selected.length === 0 || selected.includes(id);
  const count = library?.photos.filter((photo) => isOn(photo.id)).length ?? 0;

  /** Personenmarkierung speichern — rein manuell, es gibt keine Gesichtserkennung. */
  const savePerson = async (name: string, person: string) => {
    try {
      setLibrary(await api.setPhotoPerson(name, person));
    } catch {
      // Ein einzelnes fehlgeschlagenes Speichern ist kein Drama — Feld bleibt einfach stehen.
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[18rem] flex-1">
          <Field
            label="Bilderordner"
            hint="Relativ zum Projekt oder absoluter Pfad. Unterstützt jpg, png, webp, avif, gif und svg."
          >
            <input
              value={localDir}
              onChange={(event) => onChangeDir(event.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              className="field font-mono text-2xs"
            />
          </Field>
        </div>
        <button type="button" onClick={() => void load()} className="btn min-h-[52px] px-5">
          {busy ? (
            <Loader2 size={15} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <RefreshCw size={15} strokeWidth={1.7} />
          )}
          Neu einlesen
        </button>
        <button
          type="button"
          onClick={() => void pickFromGoogle()}
          disabled={googleBusy || !googleStatus?.connected}
          className="btn min-h-[52px] px-5"
          title={
            googleStatus?.connected
              ? undefined
              : 'Erst unter „Kalender" mit Google verbinden — dieselbe Verbindung gilt auch für Fotos.'
          }
        >
          {googleBusy ? (
            <Loader2 size={15} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <CloudDownload size={15} strokeWidth={1.7} />
          )}
          {googleBusy ? 'Warte auf Auswahl …' : 'Google Fotos auswählen'}
        </button>
      </div>

      {!googleStatus?.connected && (
        <p className="mb-3 text-3xs leading-relaxed text-zinc-600">
          Google Fotos brauchen eine Google-Verbindung — die richtest du unter
          „Kalender → Google Kalender" ein, sie gilt danach für beides.
        </p>
      )}

      {googleError && (
        <p className="mb-3 text-3xs leading-relaxed text-signal-warn">{googleError}</p>
      )}

      {library?.message && (
        <p className="mb-3 flex items-start gap-2.5 rounded-[3px] border border-white/[0.07] bg-white/[0.015] px-3.5 py-3">
          <FolderOpen size={14} strokeWidth={1.7} className="mt-px shrink-0 text-zinc-600" />
          <span className="text-3xs leading-relaxed text-zinc-500">{library.message}</span>
        </p>
      )}

      {library && library.photos.length > 0 && (
        <>
          <div className="mb-2.5 flex items-center gap-3">
            <span className="label">
              {count} von {library.photos.length} ausgewählt
            </span>
            <button
              type="button"
              onClick={() => onChangeSelection([])}
              className="text-3xs text-zinc-500 underline underline-offset-2"
            >
              alle
            </button>
            <button
              type="button"
              onClick={() => onChangeSelection(['__none__'])}
              className="text-3xs text-zinc-500 underline underline-offset-2"
            >
              keine
            </button>
          </div>

          <p className="mb-2.5 text-3xs leading-relaxed text-zinc-600">
            Personenmarkierung optional — nur nötig für die „Person"-Reihenfolge der
            Diashow (Einstellungen unter „Ruhemodus").
          </p>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {library.photos.map((photo) => {
              const on = isOn(photo.id);
              return (
                <div key={photo.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => toggle(photo.id)}
                    className={cx(
                      'touchable relative aspect-[4/3] overflow-hidden rounded-[3px] border',
                      on ? 'border-accent/60 shadow-glow' : 'border-white/[0.08] opacity-45',
                    )}
                    title={photo.name}
                  >
                    <img src={photo.url} alt="" className="h-full w-full object-cover" />
                    {photo.origin === 'google' && (
                      <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-zinc-300">
                        <CloudDownload size={12} strokeWidth={2} />
                      </span>
                    )}
                    {on && (
                      <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-surface-900">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-2 py-1 text-left text-3xs text-zinc-300">
                      {photo.name}
                    </span>
                  </button>
                  <input
                    defaultValue={photo.person ?? ''}
                    onBlur={(event) => void savePerson(photo.name, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                    placeholder="Person"
                    spellCheck={false}
                    className="field min-h-[38px] px-2 text-3xs"
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
