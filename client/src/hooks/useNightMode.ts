import { useCallback, useEffect, useRef, useState } from 'react';
import type { NightModeConfig } from '@shared/types';

/**
 * Nachtabsenkung und Einbrennschutz.
 *
 * Die echte Hintergrundbeleuchtung lässt sich aus dem Browser nicht steuern —
 * die Absenkung ist eine Abdunklung im Bild. Für echtes Abschalten braucht es
 * auf dem Pi DPMS oder `vcgencmd display_power`; das steht in der README.
 */

export interface NightMode {
  /** Nachtfenster ist aktiv und das Panel ist abgedunkelt. */
  dimmed: boolean;
  /** Nachtfenster ist aktiv, aber jemand hat gerade getippt. */
  awake: boolean;
  /** Nur Uhr zeigen (aus der Konfiguration, während der Nacht). */
  clockOnly: boolean;
  /** Deckkraft der Abdunklung, 0 = normal. */
  overlayOpacity: number;
  /** Versatz des Einbrennschutzes in Pixeln. */
  shift: { x: number; y: number };
  /** Panel manuell wecken (Berührung). */
  wake: () => void;
}

/** Liegt `hour` im Fenster von start bis end? Das Fenster darf Mitternacht überspannen. */
function inWindow(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function useNightMode(
  config: NightModeConfig | undefined,
  burnInProtection: boolean,
): NightMode {
  const [night, setNight] = useState(false);
  const [awake, setAwake] = useState(false);
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const wakeTimer = useRef<number | undefined>(undefined);

  // Minütlich prüfen, ob das Nachtfenster begonnen oder geendet hat.
  useEffect(() => {
    const check = () => {
      if (!config?.enabled) {
        setNight(false);
        return;
      }
      setNight(inWindow(new Date().getHours(), config.startHour, config.endHour));
    };

    check();
    const timer = window.setInterval(check, 30_000);
    return () => window.clearInterval(timer);
  }, [config?.enabled, config?.startHour, config?.endHour]);

  const wake = useCallback(() => {
    if (!config?.enabled) return;
    setAwake(true);
    window.clearTimeout(wakeTimer.current);
    wakeTimer.current = window.setTimeout(
      () => setAwake(false),
      Math.max(5, config.wakeSeconds) * 1000,
    );
  }, [config?.enabled, config?.wakeSeconds]);

  // Jede Berührung weckt das Panel — aber nur, solange es Nacht ist.
  useEffect(() => {
    if (!night) {
      setAwake(false);
      return;
    }
    const onInteract = () => wake();
    window.addEventListener('pointerdown', onInteract, { passive: true });
    window.addEventListener('keydown', onInteract);
    return () => {
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
    };
  }, [night, wake]);

  useEffect(() => () => window.clearTimeout(wakeTimer.current), []);

  /*
   * Einbrennschutz: die Oberfläche wandert sehr langsam über wenige Pixel.
   * Zwei Sinuskurven mit unteschiedlicher Periode ergeben eine Bahn, die sich
   * nicht kurzfristig wiederholt — anders als ein simples Hin und Her.
   */
  useEffect(() => {
    if (!burnInProtection) {
      setShift({ x: 0, y: 0 });
      return;
    }

    const step = () => {
      const minutes = Date.now() / 60_000;
      setShift({
        x: Math.round(Math.sin(minutes / 7) * 4),
        y: Math.round(Math.cos(minutes / 11) * 3),
      });
    };

    step();
    const timer = window.setInterval(step, 60_000);
    return () => window.clearInterval(timer);
  }, [burnInProtection]);

  const dimmed = night && !awake;

  return {
    dimmed,
    awake: night && awake,
    clockOnly: dimmed && (config?.clockOnly ?? false),
    overlayOpacity: dimmed ? 1 - Math.min(1, Math.max(0.05, config?.dimLevel ?? 0.25)) : 0,
    shift,
    wake,
  };
}
