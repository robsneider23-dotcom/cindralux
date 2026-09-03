import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Erkennt, dass das Panel gerade nicht bedient wird.
 *
 * Jede Berührung, Taste oder Mausbewegung setzt die Frist zurück. Der
 * Ruhemodus ist bewusst getrennt von der Nachtabsenkung: Diese richtet sich
 * nach der Uhrzeit, jener nach der Benutzung.
 */
export function useIdle(enabled: boolean, afterSeconds: number): {
  idle: boolean;
  wake: () => void;
} {
  const [idle, setIdle] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const arm = useCallback(() => {
    window.clearTimeout(timer.current);
    if (!enabled) {
      setIdle(false);
      return;
    }
    timer.current = window.setTimeout(
      () => setIdle(true),
      Math.max(15, afterSeconds) * 1000,
    );
  }, [enabled, afterSeconds]);

  const wake = useCallback(() => {
    setIdle(false);
    arm();
  }, [arm]);

  useEffect(() => {
    arm();

    const onActivity = () => {
      // setIdle(false) nur, wenn nötig — sonst rendert jede Mausbewegung neu.
      setIdle((current) => (current ? false : current));
      arm();
    };

    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'pointermove',
      'keydown',
      'wheel',
      'touchstart',
    ];
    for (const name of events) {
      window.addEventListener(name, onActivity, { passive: true });
    }

    return () => {
      window.clearTimeout(timer.current);
      for (const name of events) window.removeEventListener(name, onActivity);
    };
  }, [arm]);

  return { idle, wake };
}
