import { useEffect, useRef } from 'react';

/**
 * Animierter Sternenhimmel hinter der Nachtuhr.
 *
 * Das Panel zeigt dieses Bild jede Nacht stundenlang — es muss also vor allem
 * billig sein, nicht beeindruckend. Drei Entscheidungen folgen daraus:
 *
 * - Ein Canvas statt hunderter DOM-Knoten mit CSS-Animation. Der Pi zeichnet
 *   eine Flaeche, statt fuer jeden Stern Layout und Compositing zu rechnen.
 * - Zehn Bilder je Sekunde. Sterne funkeln langsam; bei 60 fps saehe es
 *   identisch aus und kostete das Sechsfache.
 * - Die Pixeldichte wird bei 1 gedeckelt. Sterne sind ein bis zwei Pixel
 *   gross, ein hochaufloesender Puffer bringt dort nichts sichtbares und
 *   vervierfacht auf einem 4K-Panel die Fuellrate.
 *
 * Dass sich das Bild langsam veraendert, ist nebenbei der beste
 * Einbrennschutz, den eine nachtfuellende Flaeche haben kann.
 */

interface Star {
  x: number;
  y: number;
  /** Radius in Pixeln. */
  r: number;
  /** Grundhelligkeit 0–1, bevor das Funkeln daraufkommt. */
  base: number;
  /** Funkelgeschwindigkeit in Bogenmass je Sekunde. */
  speed: number;
  /** Startversatz, damit nicht alle im Gleichtakt funkeln. */
  phase: number;
  /** Warmer oder kalter Stern — echte Himmel sind nicht rein weiss. */
  warm: boolean;
}

/** Sterne je Megapixel Flaeche. Haelt die Dichte ueber alle Panelgroessen gleich. */
const STARS_PER_MEGAPIXEL = 320;
const MAX_STARS = 900;
const FRAME_MS = 100;

/** Sekunden zwischen zwei Sternschnuppen — zufaellig aus diesem Bereich. */
const SHOOTING_STAR_GAP = [40, 150] as const;
const SHOOTING_STAR_MS = 900;

interface ShootingStar {
  startedAt: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  length: number;
}

function makeStars(width: number, height: number): Star[] {
  const count = Math.min(
    MAX_STARS,
    Math.round(((width * height) / 1_000_000) * STARS_PER_MEGAPIXEL),
  );
  const stars: Star[] = [];
  for (let index = 0; index < count; index += 1) {
    /*
     * Radius aus einer hoch potenzierten Zufallszahl: viele winzige Sterne,
     * wenige grosse. Gleichverteilt saehe es aus wie ein Raster aus Punkten
     * derselben Groesse, nicht wie ein Himmel.
     */
    const size = Math.random() ** 3;
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.4 + size * 1.5,
      base: 0.25 + size * 0.55 + Math.random() * 0.2,
      speed: 0.15 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      warm: Math.random() < 0.18,
    });
  }
  return stars;
}

export function Starfield({
  /** Gesamthelligkeit 0–1 — folgt der Resthelligkeit der Nachtabsenkung. */
  opacity = 1,
  /** Bewegung aus: einmal zeichnen und stehen lassen. */
  still = false,
  className,
}: {
  opacity?: number;
  still?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Als Ref, damit eine Helligkeitsaenderung die Sterne nicht neu wuerfelt.
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;

    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let shooting: ShootingStar | null = null;
    let nextShootingAt = 0;
    let frame = 0;
    let lastDrawnAt = 0;

    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      // Nie 0 — ein Canvas mit Breite 0 wirft beim Zeichnen keinen Fehler,
      // liefert aber eine leere Flaeche, die erst der naechste Resize heilt.
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      // Bewusst kein devicePixelRatio: siehe Kopfkommentar.
      canvas.width = width;
      canvas.height = height;
      stars = makeStars(width, height);
      nextShootingAt = performance.now() + gapMs();
    };

    const gapMs = () => {
      const [min, max] = SHOOTING_STAR_GAP;
      return (min + Math.random() * (max - min)) * 1000;
    };

    const draw = (now: number) => {
      const dim = opacityRef.current;

      context.fillStyle = '#04050a';
      context.fillRect(0, 0, width, height);

      /*
       * Ein sehr flauer heller Streifen quer ueber das Bild — die Andeutung
       * einer Milchstrasse. Ohne ihn wirkt die Flaeche wie zufaellig
       * verstreute Punkte; mit ihr bekommt der Himmel eine Richtung.
       */
      const band = context.createLinearGradient(0, height * 0.75, width, height * 0.1);
      band.addColorStop(0, 'rgba(70, 90, 150, 0)');
      band.addColorStop(0.45, `rgba(80, 100, 160, ${0.1 * dim})`);
      band.addColorStop(0.62, `rgba(90, 105, 165, ${0.13 * dim})`);
      band.addColorStop(1, 'rgba(70, 90, 150, 0)');
      context.fillStyle = band;
      context.fillRect(0, 0, width, height);

      const seconds = now / 1000;
      for (const star of stars) {
        const twinkle = still ? 0.8 : 0.72 + 0.28 * Math.sin(seconds * star.speed + star.phase);
        const alpha = Math.min(1, star.base * twinkle) * dim;
        if (alpha <= 0.01) continue;
        context.beginPath();
        context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        context.fillStyle = star.warm
          ? `rgba(255, 226, 190, ${alpha})`
          : `rgba(214, 228, 255, ${alpha})`;
        context.fill();
      }

      if (still) return;

      if (!shooting && now >= nextShootingAt) {
        const angle = Math.PI * (0.13 + Math.random() * 0.16);
        shooting = {
          startedAt: now,
          x: Math.random() * width * 0.7,
          y: Math.random() * height * 0.45,
          dx: Math.cos(angle),
          dy: Math.sin(angle),
          length: 90 + Math.random() * 110,
        };
      }

      if (shooting) {
        const progress = (now - shooting.startedAt) / SHOOTING_STAR_MS;
        if (progress >= 1) {
          shooting = null;
          nextShootingAt = now + gapMs();
        } else {
          const travel = progress * (width * 0.55);
          const headX = shooting.x + shooting.dx * travel;
          const headY = shooting.y + shooting.dy * travel;
          const tailX = headX - shooting.dx * shooting.length;
          const tailY = headY - shooting.dy * shooting.length;
          // Auf- und wieder abblenden, damit sie nicht hart abreisst.
          const fade = Math.sin(progress * Math.PI) * dim;
          const trail = context.createLinearGradient(tailX, tailY, headX, headY);
          trail.addColorStop(0, 'rgba(255, 255, 255, 0)');
          trail.addColorStop(1, `rgba(255, 255, 255, ${0.75 * fade})`);
          context.strokeStyle = trail;
          context.lineWidth = 1.6;
          context.lineCap = 'round';
          context.beginPath();
          context.moveTo(tailX, tailY);
          context.lineTo(headX, headY);
          context.stroke();
        }
      }
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (now - lastDrawnAt < FRAME_MS) return;
      lastDrawnAt = now;
      draw(now);
    };

    measure();
    draw(performance.now());
    if (!still) frame = requestAnimationFrame(loop);

    /*
     * Beim Neuvermessen neu wuerfeln: Die Sternpositionen sind absolute
     * Pixelwerte. Ohne das haengt nach einer Drehung des Panels der halbe
     * Himmel ausserhalb des Bildes.
     */
    const observer = new ResizeObserver(() => {
      measure();
      draw(performance.now());
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [still]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      // Der Canvas fuellt seinen Kasten; die Puffergroesse setzt measure().
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
