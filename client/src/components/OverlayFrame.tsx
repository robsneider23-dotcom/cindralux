import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { cx } from '@/lib/utils';
import { Portal } from './Portal';
import { PanelBackdrop } from './PanelBackdrop';
import { useWindowBackdrop } from '@/hooks/useWindowBackdrop';
import type { WindowId } from '@shared/types';

/**
 * Gemeinsamer Rahmen für alle Fenster, die auf Klick mittig einfahren.
 *
 * Liegt in einem Portal an <body>: `position: fixed` bezieht sich sonst nicht
 * auf das Fenster, sobald ein Vorfahre eine `transform` trägt — und genau das
 * macht der Einbrennschutz mit der gesamten Oberfläche.
 */
export function OverlayFrame({
  title,
  meta,
  icon,
  onClose,
  children,
  size = 'md',
  bodyClassName,
  backdrop,
}: {
  title: string;
  meta?: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Breite des Fensters. */
  size?: 'md' | 'lg' | 'xl';
  bodyClassName?: string;
  /** Fenster-Kennung; der Stil kommt aus den Einstellungen. */
  backdrop?: WindowId;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const backdropStyle = useWindowBackdrop(backdrop);
  const width = { md: 'max-w-3xl', lg: 'max-w-5xl', xl: 'max-w-7xl' }[size];

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[68] flex items-center justify-center bg-black/90 p-3 backdrop-blur-xl animate-fade-in md:p-6"
        onClick={onClose}
      >
        <div
          className={cx(
            'panel scanlines noise flex max-h-full w-full flex-col bg-surface-800 animate-panel-in',
            width,
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {backdropStyle && <PanelBackdrop variant={backdropStyle} />}

          <header className="panel-head relative z-10">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-3.5 w-[2px] shrink-0 rounded-full"
                style={{
                  background: 'rgb(var(--accent))',
                  boxShadow: '0 0 10px rgb(var(--accent))',
                }}
              />
              {icon && <span className="shrink-0 text-zinc-500">{icon}</span>}
              <h2 className="label truncate text-zinc-300">{title}</h2>
              {meta}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="touchable flex h-[46px] w-[46px] min-h-0 items-center justify-center rounded-[3px] border border-white/[0.09] text-zinc-400 active:border-accent/50 active:text-accent-soft"
            >
              <X size={20} strokeWidth={1.8} />
            </button>
          </header>

          <div className={cx('relative z-10 min-h-0 flex-1 overflow-y-auto', bodyClassName)}>
            {children}
          </div>
        </div>
      </div>
    </Portal>
  );
}
