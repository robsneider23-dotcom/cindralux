import { Check, Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  HomeAssistantEntityList,
  HomeAssistantEntityOption,
} from "@shared/types";
import { api } from "@/lib/api";
import { cx } from "@/lib/utils";
import { Portal } from "../Portal";

/**
 * Auswahl einer Home-Assistant-Entity.
 *
 * Ersetzt das blinde Eintippen von entity_ids: Ist Home Assistant verbunden,
 * kommt die echte Liste, sonst eine Beispielauswahl. Freie Eingabe bleibt
 * möglich, damit man auch eine noch nicht existierende Entity vorbereiten kann.
 */
export function EntityPicker({
  value,
  onChange,
  onClose,
  /** Nur diese Domains anbieten, z.B. ['sensor', 'binary_sensor']. */
  domains,
}: {
  value: string;
  onChange: (entityId: string) => void;
  onClose: () => void;
  domains?: string[];
}) {
  const [list, setList] = useState<HomeAssistantEntityList | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .entities()
      .then(setList)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : String(cause)),
      );
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const all = list?.entities ?? [];
    const scoped = domains?.length
      ? all.filter((entity) => domains.includes(entity.domain))
      : all;

    const needle = query.trim().toLowerCase();
    if (!needle) return scoped;

    return scoped.filter(
      (entity) =>
        entity.friendlyName.toLowerCase().includes(needle) ||
        entity.entityId.toLowerCase().includes(needle),
    );
  }, [list, domains, query]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
        <div className="panel scanlines noise flex max-h-full w-full max-w-3xl flex-col bg-surface-800">
          <header className="panel-head">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-3.5 w-[2px] shrink-0 rounded-full"
                style={{
                  background: "rgb(var(--accent))",
                  boxShadow: "0 0 10px rgb(var(--accent))",
                }}
              />
              <h2 className="label text-zinc-300">Entity wählen</h2>
              {list && (
                <span className="label-dim">
                  {list.mode === "live"
                    ? `${list.entities.length} aus Home Assistant`
                    : "Beispiele"}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="touchable flex h-[46px] w-[46px] min-h-0 items-center justify-center rounded-[3px] border border-white/[0.09] text-zinc-400 active:border-accent/50 active:text-accent-soft"
            >
              <X size={20} strokeWidth={1.8} />
            </button>
          </header>

          <div className="shrink-0 p-3">
            <div className="relative">
              <Search
                size={16}
                strokeWidth={1.8}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Suchen …"
                autoFocus
                className="field pl-11"
              />
            </div>
            {list?.message && (
              <p className="mt-2 text-3xs leading-relaxed text-zinc-600">
                {list.message}
              </p>
            )}
            {error && <p className="mt-2 text-3xs text-signal-err">{error}</p>}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {!list && !error && (
              <div className="flex items-center justify-center gap-2.5 py-10 text-zinc-600">
                <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
                <span className="text-2xs uppercase tracking-wide2">
                  Lade Entities …
                </span>
              </div>
            )}

            {list && results.length === 0 && (
              <p className="py-10 text-center text-2xs uppercase tracking-wide2 text-zinc-600">
                Nichts gefunden
              </p>
            )}

            <div className="space-y-1">
              {results.map((entity) => (
                <EntityRow
                  key={entity.entityId}
                  entity={entity}
                  selected={entity.entityId === value}
                  onSelect={() => {
                    onChange(entity.entityId);
                    onClose();
                  }}
                />
              ))}
            </div>
          </div>

          {/* Freie Eingabe bleibt möglich */}
          <footer className="shrink-0 border-t border-white/[0.055] p-3">
            <div className="flex gap-2">
              <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="oder entity_id direkt eintippen"
                spellCheck={false}
                autoCapitalize="off"
                className="field min-w-0 flex-1 font-mono text-2xs"
              />
              <button
                type="button"
                onClick={onClose}
                className="btn btn-accent shrink-0 px-6"
              >
                Übernehmen
              </button>
            </div>
          </footer>
        </div>
      </div>
    </Portal>
  );
}

function EntityRow({
  entity,
  selected,
  onSelect,
}: {
  entity: HomeAssistantEntityOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        "touchable flex w-full items-center gap-3 rounded-[3px] border px-3.5 text-left",
        selected
          ? "border-accent/45 bg-accent/[0.1]"
          : "border-transparent active:bg-white/[0.035]",
      )}
    >
      <span className="digits w-32 shrink-0 truncate text-3xs uppercase tracking-wide2 text-zinc-600">
        {entity.domain}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-zinc-200">
          {entity.friendlyName}
        </span>
        <span className="digits block truncate text-3xs text-zinc-600">
          {entity.entityId}
        </span>
      </span>
      <span className="digits shrink-0 text-2xs text-zinc-400">
        {entity.state}
        {entity.unit ? ` ${entity.unit}` : ""}
      </span>
      {selected && (
        <Check size={16} strokeWidth={2.2} className="shrink-0 text-accent" />
      )}
    </button>
  );
}
