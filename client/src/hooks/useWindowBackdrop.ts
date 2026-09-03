import type { BackdropStyle, WindowId } from '@shared/types';
import { useDashboard } from '@/lib/store';

/**
 * Den in den Einstellungen gewählten Hintergrundstil eines Fensters holen.
 *
 * Liegt hier statt in jeder Komponente, damit die Zuordnung Fenster → Stil an
 * genau einer Stelle steht und die Einstellungen sofort durchschlagen.
 */
export function useWindowBackdrop(window: WindowId | undefined): BackdropStyle | null {
  const { config } = useDashboard();
  if (!window) return null;
  return config?.appearance.windowBackdrops[window] ?? null;
}
