import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface PollingState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Wartet bei laufendem Abruf auf einen frischen Abruf danach. */
  reload: () => Promise<void>;
}

/** API-Antworten sind JSON; identische Inhalte behalten ihre Referenz. */
function jsonKey<T>(value: T): string {
  return JSON.stringify(value);
}

/**
 * Keine parallelen Intervallabrufe und keine Renderdurchlaeufe fuer identische
 * Antworten. Manuelles Neuladen wird nach einem laufenden Abruf nachgeholt,
 * damit eine Mutation nicht mit einer zuvor gestarteten Antwort endet.
 */
export function usePolling<T>(
  loader: () => Promise<T>,
  intervalMs: number,
  deps: unknown[] = [],
  keyOf: (value: T) => string = jsonKey,
): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  const keyRef = useRef(keyOf);
  loaderRef.current = loader;
  keyRef.current = keyOf;
  const generation = useRef(0);
  const mounted = useRef(false);
  const lastKey = useRef<string>();
  const flight = useRef<{ generation: number; again: boolean; promise: Promise<void> }>();

  const run = useCallback((refresh = false): Promise<void> => {
    if (!mounted.current) return Promise.resolve();
    const current = generation.current;
    const active = flight.current;
    if (active?.generation === current) {
      if (refresh) active.again = true;
      return active.promise;
    }

    const request = { generation: current, again: false, promise: Promise.resolve() };
    flight.current = request;
    // Microtask: auch ein synchron werfender Loader wird sauber abgefangen.
    request.promise = Promise.resolve().then(async () => {
      do {
        if (!mounted.current || generation.current !== current) return;
        request.again = false;
        try {
          const result = await loaderRef.current();
          if (!mounted.current || generation.current !== current) return;
          const key = keyRef.current(result);
          if (key !== lastKey.current) {
            lastKey.current = key;
            setData(result);
          }
          setError(null);
        } catch (cause) {
          if (!mounted.current || generation.current !== current) return;
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          if (mounted.current && generation.current === current) setLoading(false);
        }
      } while (request.again && mounted.current && generation.current === current);
    }).finally(() => {
      if (flight.current === request) flight.current = undefined;
    });
    return request.promise;
  }, []);

  const reload = useCallback(() => run(true), [run]);

  useEffect(() => {
    mounted.current = true;
    generation.current += 1;
    void run();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void run();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      mounted.current = false;
      generation.current += 1;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, run, ...deps]);

  return useMemo(() => ({ data, error, loading, reload }), [data, error, loading, reload]);
}
