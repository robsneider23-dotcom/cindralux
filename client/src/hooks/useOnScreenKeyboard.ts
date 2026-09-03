import { useMemo } from 'react';
import type { InputDevices, OnScreenKeyboardMode } from '@shared/types';
import { api } from '@/lib/api';
import { usePolling } from './usePolling';

/**
 * Entscheidet, ob die Bildschirmtastatur gebraucht wird.
 *
 * Der Browser kann eine angeschlossene Tastatur nicht sehen — nur das System.
 * Deshalb fragt der Hook den Server. Wird zwischendurch eine Tastatur
 * eingesteckt, verschwindet die Bildschirmtastatur beim naechsten Abruf von
 * selbst; eine Minute Verzoegerung ist dafuer verschmerzbar.
 */
export function useOnScreenKeyboard(mode: OnScreenKeyboardMode | undefined): boolean {
  const { data } = usePolling<InputDevices>(() => api.inputDevices(), 60_000, []);

  return useMemo(() => {
    if (mode === 'off') return false;
    if (mode === 'always') return true;

    // "auto": Solange die Antwort aussteht, nichts einblenden — eine Tastatur,
    // die kurz aufblitzt und wieder verschwindet, wirkt kaputt.
    if (!data) return false;
    return !data.physicalKeyboard;
  }, [mode, data]);
}
