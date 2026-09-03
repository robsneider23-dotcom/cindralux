/** Klassen-Merge ohne externe Abhaengigkeit. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Hex-Farbe in "r g b" fuer CSS-Variablen und rgb(... / alpha). */
export function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = Number.parseInt(full, 16);
  return `${(num >> 16) & 255} ${(num >> 8) & 255} ${num & 255}`;
}

/** Farbe mit Alpha, ohne die Farbe selbst zu kennen. */
export function withAlpha(hex: string, alpha: number): string {
  return `rgb(${hexToRgbTriplet(hex).split(' ').join(', ')} / ${alpha})`;
}

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
