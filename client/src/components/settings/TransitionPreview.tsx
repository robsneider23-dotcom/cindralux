import { useEffect, useState } from 'react';
import type { SlideTransition } from '@shared/types';
import { transitionSpec } from '@/lib/transitions';

/** Zwei kontrastreiche Kacheln, damit der Effekt erkennbar ist. */
const TILES = [
  'linear-gradient(140deg, #ff5a1f, #7c2d12 70%)',
  'linear-gradient(140deg, #0284c7, #0c4a6e 70%)',
];

/**
 * Kleine Endlosvorschau eines Übergangs.
 *
 * Ohne laufendes Bild ist ein Effektname wertlos — „Lamellen senkrecht" sagt
 * niemandem, wie es aussieht. Die Vorschau läuft nur, wenn sie sichtbar ist.
 */
export function TransitionPreview({
  transition,
  className,
}: {
  transition: SlideTransition;
  className?: string;
}) {
  const spec = transitionSpec(transition);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Etwas Ruhe zwischen den Durchläufen, sonst wirkt es hektisch.
    const period = spec.duration + 900;
    const timer = window.setInterval(() => setStep((value) => value + 1), period);
    return () => window.clearInterval(timer);
  }, [spec.duration]);

  const current = step % 2;
  const previous = (step + 1) % 2;

  return (
    <span
      className={className}
      style={{ position: 'relative', display: 'block', overflow: 'hidden' }}
      aria-hidden
    >
      <span
        key={`b-${step}`}
        style={{ position: 'absolute', inset: 0, background: TILES[previous] }}
      />
      <span
        key={`a-${step}`}
        style={{ position: 'absolute', inset: 0, background: TILES[current], animation: spec.enter }}
      />
    </span>
  );
}
