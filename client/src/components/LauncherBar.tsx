import { Activity, House, ListChecks, Sparkles, Timer } from 'lucide-react';
import { useState } from 'react';
import { useDashboard } from '@/lib/store';
import { cx } from '@/lib/utils';
import { SensorPanel } from './SensorPanel';
import { SmartHomePanel } from './SmartHomePanel';
import { AiAssistantPanel } from './AiAssistantPanel';
import { ListsPanel } from './ListsPanel';
import { OverlayFrame } from './OverlayFrame';
import { TimerChips } from './TimerChips';
import { TimerQuickAdd } from './TimerQuickAdd';
import { presetColumns } from '@/lib/layouts';

type Launcher = 'smarthome' | 'zuhause' | 'assistent' | 'listen' | null;

/**
 * Startleiste am unteren Rand.
 *
 * Smart Home, Messwerte und Assistent belegen keinen Platz mehr dauerhaft,
 * sondern öffnen sich auf Tipp als Fenster. Dadurch bleibt oben deutlich mehr
 * Raum für Kalender und Tagesübersicht — die Dinge, die man im Vorbeigehen
 * liest, ohne etwas anzutippen.
 */
export function LauncherBar({ className }: { className?: string }) {
  const { homeAssistant, sensors, config, lists } = useDashboard();
  const [open, setOpen] = useState<Launcher>(null);
  const [timerDialog, setTimerDialog] = useState(false);

  const alerts = sensors.filter((sensor) => sensor.alert).length;
  const activeTiles = (homeAssistant?.entities ?? []).filter(
    (entity) => entity.state === 'on' || entity.state === 'heat',
  ).length;
  const aiReady = config?.ai.hasApiKey ?? false;
  const openShoppingItems = (lists?.shopping ?? []).filter((item) => !item.done).length;

  // Was schon als Kachel im Raster steht, braucht keinen zweiten Knopf hier
  // unten — sonst steht z.B. Smart Home doppelt auf dem Bildschirm.
  const layout = config?.layout;
  const inGrid = new Set(
    (layout?.preset === 'custom' ? (layout.custom ?? []) : presetColumns(layout?.preset ?? 'standard'))
      .flatMap((column) => column.panels),
  );

  return (
    <>
      <section className={cx('panel flex shrink-0 items-stretch gap-1 p-1.5', className)}>
        {!inGrid.has('smarthome') && (
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
        )}

        {!inGrid.has('sensors') && (
        <LauncherButton
          icon={<Activity size={22} strokeWidth={1.5} />}
          label="Zuhause"
          hint={sensors.length > 0 ? `${sensors.length} Messwerte` : 'nicht eingerichtet'}
          badge={alerts > 0 ? alerts : undefined}
          badgeAlert={alerts > 0}
          onClick={() => setOpen('zuhause')}
        />
        )}

        {!inGrid.has('assistant') && (
        <LauncherButton
          icon={<Sparkles size={22} strokeWidth={1.5} />}
          label="Assistent"
          hint={aiReady ? 'Fragen oder sprechen' : 'lokale Antworten'}
          onClick={() => setOpen('assistent')}
        />
        )}

        {!inGrid.has('lists') && (
        <LauncherButton
          icon={<ListChecks size={22} strokeWidth={1.5} />}
          label="Liste"
          hint={openShoppingItems > 0 ? `${openShoppingItems} offen` : 'Einkaufsliste & Notizen'}
          badge={openShoppingItems > 0 ? openShoppingItems : undefined}
          onClick={() => setOpen('listen')}
        />
        )}

        <LauncherButton
          icon={<Timer size={22} strokeWidth={1.5} />}
          label="Timer"
          hint="Timer oder Wecker stellen"
          onClick={() => setTimerDialog(true)}
        />

        {/* Laufende Timer rechts; der Knopf zum Stellen steht jetzt beschriftet
            in der Leiste. TimerChips zeichnet nichts, solange keiner laeuft. */}
        <div className="flex shrink-0 items-center gap-2 px-2 empty:hidden">
          <TimerChips />
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

      {open === 'listen' && (
        <OverlayFrame
          title="Liste"
          icon={<ListChecks size={13} strokeWidth={1.6} />}
          size="lg"
          backdrop="lists"
          onClose={() => setOpen(null)}
          bodyClassName="flex flex-col overflow-hidden"
        >
          <ListsPanel />
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
      className="touchable launcher-button relative flex min-w-0 flex-1 items-center gap-3.5 px-5 text-left transition-colors duration-200 active:bg-accent/[0.09] short:gap-2.5 short:px-3.5"
    >
      <span className="launcher-icon shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[clamp(0.9rem,1.2vw,1.05rem)] font-medium leading-tight text-zinc-100">
          {label}
        </span>
        {hint && (
          <span className="mt-1 block truncate text-2xs text-zinc-400 short:hidden">{hint}</span>
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
