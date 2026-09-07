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
  return `rgb(${hexToRgbTriplet(hex)} / ${alpha})`;
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgbTriplet(hex).split(' ').map(Number) as [number, number, number];
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n: number) =>
    Math.round(f(n) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

/**
 * Vier Abstufungen aus einer einzigen selbst gewaehlten Farbe ableiten —
 * fuer das Theme "Eigene Farbe", das sonst nur einen Hex-Wert kennt statt der
 * vier Stufen, die jedes andere Theme mitbringt (base/soft/hot/dim).
 *
 * `soft` heller und etwas entsaettigt (fuer Text auf dunklem Grund), `hot`
 * kraeftiger (fuer helles Design), `dim` deutlich dunkler (fuer Text auf
 * hellem Grund). Dieselbe Rolle wie bei den festen Paletten, nur errechnet
 * statt von Hand abgestimmt — deshalb bewusst kein Anspruch auf denselben
 * Feinschliff.
 */
export function deriveAccentShades(hex: string): {
  base: string;
  soft: string;
  hot: string;
  dim: string;
} {
  const [h, s, l] = hexToHsl(hex);
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  return {
    base: hex,
    soft: hslToHex(h, clamp(s * 0.85), clamp(l + 0.16)),
    hot: hslToHex(h, clamp(s * 1.1), clamp(l - 0.1)),
    dim: hslToHex(h, clamp(s * 0.9), clamp(l - 0.28)),
  };
}

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
