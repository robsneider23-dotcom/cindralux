import { useEffect, useMemo, useRef, useState } from 'react';
import type { PhotoItem, SlideshowConfig } from '@shared/types';
import { randomTransition, transitionSpec, type TransitionSpec } from '@/lib/transitions';

/**
 * Diashow im Ruhemodus.
 *
 * Zwei übereinanderliegende Ebenen: Die untere hält das aktuelle Bild, die
 * obere bringt das neue herein. Nach dem Übergang wird getauscht — so bleibt
 * immer nur ein Bilderpaar im Speicher, was auf einem Pi zählt.
 */
export function PhotoSlideshow({
  photos,
  config,
  className,
}: {
  photos: PhotoItem[];
  config: SlideshowConfig;
  className?: string;
}) {
  // Reihenfolge einmal festlegen, damit sie beim Neuzeichnen stabil bleibt.
  const order = useMemo(() => {
    const list = [...photos];
    if (!config.shuffle) return list;
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j] as PhotoItem, list[i] as PhotoItem];
    }
    return list;
  }, [photos, config.shuffle]);

  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [spec, setSpec] = useState<TransitionSpec>(() =>
    transitionSpec(config.transition, config.intervalSeconds),
  );
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (order.length < 2) return;

    const advance = () => {
      setSpec(
        config.randomTransition
          ? randomTransition(undefined, config.intervalSeconds)
          : transitionSpec(config.transition, config.intervalSeconds),
      );
      setPrevious(index);
      setIndex((current) => (current + 1) % order.length);
    };

    timer.current = window.setTimeout(advance, Math.max(4, config.intervalSeconds) * 1000);
    return () => window.clearTimeout(timer.current);
  }, [index, order.length, config.intervalSeconds, config.transition, config.randomTransition]);

  // Die weichende Ebene nach dem Übergang entfernen.
  useEffect(() => {
    if (previous === null) return;
    const done = window.setTimeout(() => setPrevious(null), spec.duration + 120);
    return () => window.clearTimeout(done);
  }, [previous, spec.duration]);

  if (order.length === 0) return null;

  const current = order[index];
  const leaving = previous !== null ? order[previous] : undefined;

  return (
    <div className={className}>
      {leaving && (
        <img
          key={`leave-${leaving.id}-${previous}`}
          src={leaving.url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={spec.leave ? { animation: spec.leave } : undefined}
        />
      )}

      {current && (
        <img
          key={`enter-${current.id}-${index}`}
          src={current.url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ animation: spec.enter }}
        />
      )}
    </div>
  );
}
