import { useRef } from 'react';

/**
 * Horizontales Wischen erkennen — für Tages-/Monatsnavigation im Kalender.
 *
 * Bewertet wird erst beim Loslassen (Start- gegen Endposition), nicht laufend
 * während der Bewegung: So bleibt jedes vertikale Scrollen im selben Bereich
 * unberührt, weil die Bewertung nur bei überwiegend horizontalem Versatz
 * überhaupt auslöst.
 *
 * SICHERHEIT/ROBUSTHEIT: An die pointerId des ERSTEN Zeigers gebunden, jeder
 * weitere wird bis zum Loslassen ignoriert — der Touchscreen meldet sich als
 * Touch- UND Mausgerät gleichzeitig und kann pro Berührung zwei überlappende
 * Zeiger-Ströme auslösen (siehe FocusPointEditor.tsx, dieselbe Lehre).
 */
export interface SwipeHandlers {
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  onPointerCancel: (event: React.PointerEvent) => void;
}

const THRESHOLD_PX = 56;
/** Ab diesem Verhältnis gilt ein Wisch als "horizontal genug", nicht als Scrollversuch. */
const MIN_HORIZONTAL_RATIO = 1.4;

export function useSwipe(onSwipeLeft?: () => void, onSwipeRight?: () => void): SwipeHandlers {
  const start = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent) => {
    if (start.current) return;
    start.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    // Ohne das entscheidet oft die native Scroll-Gestenerkennung mit und
    // bricht die Zeigerfolge per pointercancel ab, bevor pointerup unsere
    // eigene Auswertung erreicht — siehe FocusPointEditor.tsx, wo genau das
    // schon einmal der Fall war.
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const finish = (event: React.PointerEvent) => {
    const s = start.current;
    if (!s || event.pointerId !== s.pointerId) return;
    start.current = null;

    const dx = event.clientX - s.x;
    const dy = event.clientY - s.y;
    if (Math.abs(dx) < THRESHOLD_PX) return;
    if (Math.abs(dx) < Math.abs(dy) * MIN_HORIZONTAL_RATIO) return;

    if (dx < 0) onSwipeLeft?.();
    else onSwipeRight?.();
  };

  const cancel = (event: React.PointerEvent) => {
    if (start.current?.pointerId === event.pointerId) start.current = null;
  };

  return { onPointerDown, onPointerUp: finish, onPointerCancel: cancel };
}
