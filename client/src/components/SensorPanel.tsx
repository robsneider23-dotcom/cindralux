import {
  Activity,
  BatteryMedium,
  Blinds,
  DoorOpen,
  Droplets,
  Gauge,
  House,
  Radar,
  Sun,
  Thermometer,
  WashingMachine,
  Waves,
  type LucideProps,
} from 'lucide-react';
import type { SensorIcon, SensorReading } from '@shared/types';
import { useDashboard } from '@/lib/store';
import { cx } from '@/lib/utils';

const ICONS: Record<SensorIcon, React.ComponentType<LucideProps>> = {
  temperature: Thermometer,
  humidity: Droplets,
  window: Blinds,
  door: DoorOpen,
  power: Gauge,
  solar: Sun,
  battery: BatteryMedium,
  motion: Radar,
  water: Waves,
  washer: WashingMachine,
  presence: House,
  generic: Activity,
};

/**
 * Messwerte aus Home Assistant als Kachelraster.
 *
 * Im Fenster ist Platz — deshalb große Zahlen statt einer gedrängten Leiste.
 * Auffällige Werte (offenes Fenster) tragen eine Ember-Kante und stehen vorn.
 */
export function SensorPanel() {
  const { sensors, homeAssistant } = useDashboard();

  if (sensors.length === 0) {
    return (
      <p className="px-6 py-14 text-center text-2xs uppercase tracking-wide2 text-zinc-600">
        Noch keine Messwerte eingerichtet — Einstellungen → Zuhause
      </p>
    );
  }

  // Auffälliges zuerst: ein offenes Fenster soll man nicht suchen müssen.
  const ordered = [...sensors].sort((a, b) => Number(b.alert) - Number(a.alert));
  const mock = homeAssistant?.mode !== 'live';

  return (
    <div className="p-4">
      {mock && (
        <p className="mb-3 text-3xs leading-relaxed text-zinc-600">
          Home Assistant ist nicht verbunden — die Werte sind plausible Beispiele, die dem
          Tagesgang folgen.
        </p>
      )}

      {/*
        Spalten nach der eigenen Breite statt nach der des Bildschirms: Die
        Messwerte stehen mal in einem breiten Fenster, mal in einer schmalen
        Rasterspalte. Mit Viewport-Breakpoints blieben es dort vier Spalten,
        in denen die Beschriftungen abgeschnitten werden.
      */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-2.5">
        {ordered.map((sensor) => (
          <SensorTile key={sensor.id} sensor={sensor} />
        ))}
      </div>
    </div>
  );
}

function SensorTile({ sensor }: { sensor: SensorReading }) {
  const Icon = ICONS[sensor.icon] ?? Activity;

  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-[3px] border p-4 transition-colors duration-300',
        sensor.alert
          ? 'border-transparent bg-accent/[0.1]'
          : 'border-white/[0.07] bg-white/[0.015]',
        !sensor.available && 'opacity-40',
      )}
      style={
        sensor.alert
          ? { boxShadow: 'inset 0 0 0 1px rgb(var(--accent) / 0.4), 0 0 30px -14px rgb(var(--accent))' }
          : undefined
      }
      title={sensor.entityId}
    >
      {sensor.alert && (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{ background: 'rgb(var(--accent))', boxShadow: '0 0 12px rgb(var(--accent))' }}
        />
      )}

      <Icon
        size={20}
        strokeWidth={1.5}
        className={cx('mb-3', sensor.alert ? 'text-accent' : 'text-zinc-500')}
      />

      <div
        className={cx(
          'digits text-[clamp(1.3rem,2.2vw,1.7rem)] font-light leading-none',
          sensor.alert ? 'text-accent-soft' : 'text-zinc-50',
        )}
      >
        {sensor.display}
      </div>

      <div className="mt-2 truncate text-2xs text-zinc-400">{sensor.label}</div>
      <div className="digits mt-1 truncate text-3xs text-zinc-700">{sensor.entityId}</div>
    </div>
  );
}
