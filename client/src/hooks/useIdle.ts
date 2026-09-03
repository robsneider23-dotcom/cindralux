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

    /*
     * pointermove zaehlt nur bei echter Bewegung.
     *
     * Manche Touch-Panels senden bei Naeherung oder elektrischem Rauschen
     * pointermove-Events, ohne dass jemand den Bildschirm beruehrt hat —
     * dabei bleibt die Position (fast) gleich. Ohne diese Schwelle haelt so
     * ein Panel den Ruhemodus dauerhaft wach, obwohl niemand davorsteht.
     * pointerdown/touchstart bleiben Schwellen-frei: ein echter Tipp zaehlt
     * immer.
     */
    let lastX: number | null = null;
    let lastY: number | null = null;
    const MOVE_THRESHOLD_PX = 4;

    const onPointerMove = (event: PointerEvent) => {
      if (lastX !== null && lastY !== null) {
        const moved = Math.hypot(event.clientX - lastX, event.clientY - lastY);
        if (moved < MOVE_THRESHOLD_PX) return;
      }
      lastX = event.clientX;
      lastY = event.clientY;
      onActivity();
    };

    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'wheel',
      'touchstart',
    ];
    for (const name of events) {
      window.addEventListener(name, onActivity, { passive: true });
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    return () => {
      window.clearTimeout(timer.current);
      for (const name of events) window.removeEventListener(name, onActivity);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [arm]);

  return { idle, wake };
}
