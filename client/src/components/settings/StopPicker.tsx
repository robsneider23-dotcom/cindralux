import { useCallback, useEffect, useRef, useState } from "react";
import { Bus, Check, Loader2, Search, X } from "lucide-react";
import type { TransitStopSuggestion } from "@shared/types";
import { api } from "@/lib/api";
import { cx } from "@/lib/utils";

/**
 * Haltestellensuche.
 *
 * Gesucht wird gegen die bundesweiten Fahrplandaten, und die Suche ist
 * unscharf: "Straubing" liefert auch das oesterreichische "Stübing". Deshalb
 * steht neben jedem Treffer die Region, und gewaehlt wird per Tippen statt
 * per Freitext — die Kennung dahinter koennte niemand von Hand eintragen.
 */
export function StopPicker({
  label,
  hint,
  selectedName,
  onSelect,
  onClear,
}: {
  label: string;
  hint?: string;
  selectedName: string;
  onSelect: (stop: TransitStopSuggestion) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TransitStopSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const generation = useRef(0);

  const search = useCallback(async (text: string) => {
    const current = ++generation.current;
    if (text.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const found = await api.transitStops(text);
      // Eine spaeter gestartete Suche hat Vorrang — sonst ueberschreibt die
      // langsamere Antwort auf "Stra" das Ergebnis zu "Straubing".
      if (generation.current !== current) return;
      setResults(found);
      setError(null);
    } catch (cause) {
      if (generation.current !== current) return;
      setResults([]);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }, []);

  // Nicht bei jedem Tastendruck abfragen: Die Suche geht an einen fremden
  // Dienst, und wer "Straubing" tippt, loest sonst neun Anfragen aus.
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void search(query), 350);
    return () => window.clearTimeout(timer.current);
  }, [query, search]);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-3xs uppercase tracking-label text-zinc-500">{label}</span>
        {selectedName && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-3xs text-zinc-500 hover:text-zinc-300"
          >
            <X size={11} strokeWidth={2} />
            entfernen
          </button>
        )}
      </div>

      {selectedName ? (
        <div className="mb-2 flex items-center gap-2 rounded-[3px] border border-accent/25 bg-accent/[0.07] px-3 py-2.5">
          <Check size={13} strokeWidth={2} className="shrink-0 text-accent" />
          <span className="min-w-0 truncate text-sm text-zinc-100">{selectedName}</span>
        </div>
      ) : (
        hint && <p className="mb-2 text-3xs text-zinc-600">{hint}</p>
      )}

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600">
          {loading ? (
            <Loader2 size={13} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <Search size={13} strokeWidth={1.8} />
          )}
        </span>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={selectedName ? "Andere Haltestelle suchen …" : "Haltestelle suchen …"}
          className="field pl-9"
        />
      </div>

      {error && (
        <p className="mt-1.5 text-3xs text-red-400">Suche fehlgeschlagen: {error}</p>
      )}

      {results.length > 0 && (
        <ul className="mt-2 max-h-60 overflow-y-auto rounded-[3px] border border-white/[0.07]">
          {results.map((stop) => (
            <li key={stop.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(stop);
                  setQuery("");
                  setResults([]);
                }}
                className={cx(
                  "flex w-full items-center gap-2.5 border-b border-white/[0.04] px-3 py-2.5 text-left",
                  "last:border-0 hover:bg-white/[0.04] active:bg-white/[0.07]",
                )}
              >
                <Bus size={13} strokeWidth={1.6} className="shrink-0 text-zinc-600" />
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                  {stop.name}
                </span>
                {stop.region && (
                  <span className="shrink-0 text-3xs text-zinc-600">{stop.region}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
