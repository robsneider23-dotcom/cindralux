import { useCallback, useEffect, useRef, useState } from 'react';

export interface PollingState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Manuell neu laden, z.B. nach einer Konfigurationsaenderung. */
  reload: () => Promise<void>;
}

/**
 * Laedt eine Ressource und aktualisiert sie im Intervall.
 *
 * Das Dashboard laeuft wochenlang ohne Neuladen — deshalb pausiert das Polling,
 * solange der Tab unsichtbar ist, und holt beim Zurueckkehren sofort nach.
 */
export function usePolling<T>(
  loader: () => Promise<T>,
  intervalMs: number,
  deps: unknown[] = [],
): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const mounted = useRef(true);

  const run = useCallback(async () => {
    try {
      const result = await loaderRef.current();
      if (!mounted.current) return;
      setData(result);
      setError(null);
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
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
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, run, ...deps]);

  return { data, error, loading, reload: run };
}
