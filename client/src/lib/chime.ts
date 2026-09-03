/**
 * Klingelton für ablaufende Timer.
 *
 * Bewusst per WebAudio erzeugt statt als Audiodatei: kein Asset, keine
 * Ladezeit, und die Lautstärke lässt sich sauber ein- und ausblenden.
 * Browser erlauben Ton erst nach einer Nutzerinteraktion — auf einem
 * Touch-Panel ist das kein Problem, es wird ohnehin getippt.
 */

let context: AudioContext | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** Ein Doppelton — freundlich, aber nicht zu überhören. */
export function playChime(): void {
  const ctx = ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Zwei Töne im Quartabstand, jeweils weich ein- und ausgeblendet.
  [
    { freq: 880, at: 0 },
    { freq: 1174.66, at: 0.18 },
  ].forEach(({ freq, at }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, now + at);
    gain.gain.linearRampToValueAtTime(0.22, now + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.55);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now + at);
    osc.stop(now + at + 0.6);
  });
}

/** Vom ersten Antippen aufrufen, damit der Ton später ohne Geste laufen darf. */
export function unlockAudio(): void {
  ensureContext();
}
