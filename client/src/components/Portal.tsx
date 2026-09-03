import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Hängt Overlays direkt unter <body>.
 *
 * `position: fixed` bezieht sich nicht auf das Fenster, sobald irgendein
 * Vorfahre eine `transform`, `filter` oder `backdrop-filter` trägt — dann wird
 * dieser Vorfahre zum Bezugsrahmen. Genau das trifft hier zu: der Einbrennschutz
 * verschiebt die gesamte Oberfläche per transform, und die Panels benutzen
 * backdrop-filter. Ein Portal umgeht das zuverlässig, statt sich auf die
 * jeweilige Verschachtelung zu verlassen.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // Beim ersten Rendern gibt es document.body im SSR-Fall noch nicht.
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
