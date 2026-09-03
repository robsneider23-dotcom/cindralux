import { useEffect, useState } from 'react';

/**
 * Uhrzeit, die exakt auf der Sekunden- bzw. Minutengrenze tickt.
 * Ein fixes setInterval driftet mit der Zeit sichtbar auseinander.
 */
export function useClock(withSeconds: boolean): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: number;

    const schedule = () => {
      const current = new Date();
      setNow(current);
      const period = withSeconds ? 1000 : 60_000;
      const elapsed = withSeconds
        ? current.getMilliseconds()
        : current.getSeconds() * 1000 + current.getMilliseconds();
      timer = window.setTimeout(schedule, period - elapsed);
    };

    schedule();
    return () => window.clearTimeout(timer);
  }, [withSeconds]);

  return now;
}
