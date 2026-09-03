import { Activity, House, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useDashboard } from '@/lib/store';
import { cx } from '@/lib/utils';
import { SensorPanel } from './SensorPanel';
import { SmartHomePanel } from './SmartHomePanel';
import { AiAssistantPanel } from './AiAssistantPanel';
import { OverlayFrame } from './OverlayFrame';
import { TimerChips } from './TimerChips';
import { TimerQuickAdd } from './TimerQuickAdd';

type Launcher = 'smarthome' | 'zuhause' | 'assistent' | null;

/**
 * Startleiste am unteren Rand.
 *
 * Smart Home, Messwerte und Assistent belegen keinen Platz mehr dauerhaft,
 * sondern öffnen sich auf Tipp als Fenster. Dadurch bleibt oben deutlich mehr
 * Raum für Kalender und Tagesübersicht — die Dinge, die man im Vorbeigehen
 * liest, ohne etwas anzutippen.
 */
export function LauncherBar({ className }: { className?: string }) {
  const { homeAssistant, sensors, config } = useDashboard();
  const [open, setOpen] = useState<Launcher>(null);
  const [timerDialog, setTimerDialog] = useState(false);

  const alerts = sensors.filter((sensor) => sensor.alert).length;
  const activeTiles = (homeAssistant?.entities ?? []).filter(
    (entity) => entity.state === 'on' || entity.state === 'heat',
  ).length;
  const aiReady = config?.ai.hasApiKey ?? false;

  return (
    <>
      <section className={cx('panel scanlines noise flex shrink-0 items-stretch gap-px', className)}>
        <LauncherButton
          icon={<House size={22} strokeWidth={1.5} />}
          label="Smart Home"
          hint={
            homeAssistant?.mode === 'live'
              ? `${activeTiles} aktiv`
              : 'Simulation'
          }
          badge={activeTiles > 0 ? activeTiles : undefined}
          onClick={() => setOpen('smarthome')}
        />

        <LauncherButton
          icon={<Activity size={22} strokeWidth={1.5} />}
          label="Zuhause"
          hint={sensors.length > 0 ? `${sensors.length} Messwerte` : 'nicht eingerichtet'}
          badge={alerts > 0 ? alerts : undefined}
          badgeAlert={alerts > 0}
          onClick={() => setOpen('zuhause')}
        />

        <LauncherButton
          icon={<Sparkles size={22} strokeWidth={1.5} />}
          label="Assistent"
          hint={aiReady ? config?.ai.model : 'lokale Antworten'}
          onClick={() => setOpen('assistent')}
        />

        {/* Timer rechts, außerhalb der Startknöpfe */}
        <div className="flex shrink-0 items-center gap-2 border-l border-white/[0.055] px-3 short:px-2">
          <TimerChips />
          <button
            type="button"
            onClick={() => setTimerDialog(true)}
            aria-label="Timer oder Wecker stellen"
            className="touchable flex h-11 w-11 min-h-0 items-center justify-center rounded-[3px] border border-white/[0.09] bg-white/[0.025] text-zinc-400 active:border-accent/50 active:bg-accent/15 active:text-accent-soft short:h-9 short:w-9"
          >
            <Plus size={19} strokeWidth={1.8} />
          </button>
        </div>
      </section>

      {open === 'smarthome' && (
        <OverlayFrame
          title="Smart Home"
          icon={<House size={13} strokeWidth={1.6} />}
          meta={
            homeAssistant?.mode !== 'live' ? (
              <span className="shrink-0 rounded-[2px] border border-signal-warn/25 bg-signal-warn/[0.07] px-1.5 py-0.5 text-3xs uppercase tracking-wide2 text-signal-warn">
                Simulation
              </span>
            ) : undefined
          }
          size="xl"
          backdrop="smarthome"
          onClose={() => setOpen(null)}
        >
          <SmartHomePanel variant="overlay" />
        </OverlayFrame>
      )}

      {open === 'zuhause' && (
        <OverlayFrame
          title="Zuhause"
          icon={<Activity size={13} strokeWidth={1.6} />}
          meta={
            alerts > 0 ? (
              <span className="digits rounded-[2px] border border-accent/30 bg-accent/[0.1] px-1.5 py-0.5 text-3xs text-accent-soft">
                {alerts} auffällig
              </span>
            ) : undefined
          }
          size="lg"
          backdrop="sensors"
          onClose={() => setOpen(null)}
        >
          <SensorPanel />
        </OverlayFrame>
      )}

      {open === 'assistent' && (
        <OverlayFrame
          title="Assistent"
          icon={<Sparkles size={13} strokeWidth={1.6} />}
          size="lg"
          backdrop="assistant"
          onClose={() => setOpen(null)}
          bodyClassName="flex flex-col overflow-hidden"
        >
          <AiAssistantPanel variant="overlay" className="min-h-[26rem] flex-1" />
        </OverlayFrame>
      )}

      {timerDialog && <TimerQuickAdd onClose={() => setTimerDialog(false)} />}
    </>
  );
}

function LauncherButton({
  icon,
  label,
  hint,
  badge,
  badgeAlert,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  badge?: number;
  badgeAlert?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="touchable relative flex min-w-0 flex-1 items-center gap-3.5 px-5 text-left transition-colors duration-200 active:bg-accent/[0.09] short:gap-2.5 short:px-3.5"
    >
      <span className="shrink-0 text-zinc-400">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[clamp(0.9rem,1.2vw,1.05rem)] font-medium leading-tight text-zinc-100">
          {label}
        </span>
        {hint && (
          <span className="mt-1 block truncate text-3xs text-zinc-500 short:hidden">{hint}</span>
        )}
      </span>
      {badge !== undefined && (
        <span
          className={cx(
            'digits ml-auto shrink-0 rounded-[2px] border px-2 py-1 text-3xs',
            badgeAlert
              ? 'border-accent/40 bg-accent/[0.12] text-accent-soft'
              : 'border-white/[0.1] bg-white/[0.03] text-zinc-400',
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
