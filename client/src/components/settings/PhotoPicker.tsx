import { Check, FolderOpen, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { PhotoLibrary } from '@shared/types';
import { api } from '@/lib/api';
import { cx } from '@/lib/utils';
import { Field } from './SettingsControls';

/**
 * Bildauswahl für die Diashow.
 *
 * Zeigt alle Bilder des Ordners als Miniaturen; ein Tipp nimmt eines auf oder
 * heraus. Ohne jede Auswahl laufen alle — sonst bliebe die Diashow leer,
 * solange niemand etwas angehakt hat.
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
  }, [load]);

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
      </div>

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

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {library.photos.map((photo) => {
              const on = isOn(photo.id);
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => toggle(photo.id)}
                  className={cx(
                    'touchable relative aspect-[4/3] overflow-hidden rounded-[3px] border',
                    on ? 'border-accent/60 shadow-glow' : 'border-white/[0.08] opacity-45',
                  )}
                  title={photo.name}
                >
                  <img src={photo.url} alt="" className="h-full w-full object-cover" />
                  {on && (
                    <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-surface-900">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-2 py-1 text-left text-3xs text-zinc-300">
                    {photo.name}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
