import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { TimerListResponse } from '@shared/types';
import { api } from './api';
import { usePolling } from '@/hooks/usePolling';

/**
 * Eigener, kleiner Kontext nur fuer Timer/Wecker.
 *
 * Stand vorher: Timer waren Teil des grossen DashboardContext, der Kalender,
 * Wetter, Muell, Home Assistant, Sensoren, Timer und Listen in einem
 * einzigen useMemo buendelt. Weil Timer alle 2 Sekunden pollen — mit Abstand
 * der schnellste Takt im ganzen Dashboard — loeste das alle 2 Sekunden einen
 * Neu-Render der KOMPLETTEN App aus (20 Komponenten haengen an
 * useDashboard()), egal ob ueberhaupt ein Timer laeuft. Auf einem Pi macht
 * sich das als spuerbar traege Touch-Reaktion bemerkbar: Ein Tipp konkurriert
 * mit einem Rendering-Durchlauf durch die ganze Baumstruktur.
 *
 * Nur vier Komponenten brauchen Timer ueberhaupt (TimerChips, TimerOverlay,
 * TimerQuickAdd, AiAssistantPanel) — die bekommen jetzt ihren eigenen,
 * schnell tickenden Kontext, ohne alle anderen 16 mitzureissen.
 */

const TIMERS_INTERVAL_MS = 2_000;

interface TimersValue {
  timers: TimerListResponse | null;
  reloadTimers: () => Promise<void>;
}

const TimersContext = createContext<TimersValue | null>(null);

// serverTime wird im Client nicht verwendet; allein sein Ticken ist kein UI-Update.
const timerKey = (response: TimerListResponse) => JSON.stringify(response.timers);

export function TimersProvider({ children }: { children: ReactNode }) {
  const timers = usePolling(() => api.timers(), TIMERS_INTERVAL_MS, [], timerKey);

  const value = useMemo<TimersValue>(
    () => ({ timers: timers.data, reloadTimers: timers.reload }),
    [timers.data, timers.reload],
  );

  return <TimersContext.Provider value={value}>{children}</TimersContext.Provider>;
}

export function useTimers(): TimersValue {
  const context = useContext(TimersContext);
  if (!context) throw new Error('useTimers muss innerhalb von TimersProvider stehen');
  return context;
}
