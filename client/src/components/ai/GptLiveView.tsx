import { AlertTriangle, ExternalLink, Loader2, MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useDashboard } from '@/lib/store';
import { cx } from '@/lib/utils';

/**
 * Verknüpfung zu ChatGPT.
 *
 * Bewusst nur ein Startknopf, keine Einbettung: chatgpt.com setzt
 * `frame-ancestors`, ein iframe wird vom Browser blockiert. Inoffizielle
 * Umwege wären weder stabil noch zulässig — der ehrliche Weg ist ein eigenes
 * Fenster.
 */
export function GptLiveView() {
  const { config } = useDashboard();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const gptLive = config?.ai.gptLive;
  const url = gptLive?.url ?? 'https://chatgpt.com';
  const kiosk = gptLive?.mode === 'local-command';

  const open = async () => {
    setBusy(true);
    setResult(null);

    try {
      const response = await api.openGptLive();

      if (response.handledBy === 'client') {
        // Der Browser öffnet selbst. Popup-Blocker melden sich mit null.
        const win = window.open(response.url, '_blank', 'noopener,noreferrer');
        setResult(
          win
            ? { ok: true, message: 'In neuem Fenster geöffnet' }
            : {
                ok: false,
                message:
                  'Der Browser hat das Fenster blockiert. Popups für diese Seite erlauben — ' +
                  'oder in den Einstellungen auf „Befehl auf dem Gerät" umstellen.',
              },
        );
      } else {
        setResult({ ok: response.ok, message: response.message });
      }
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  };

  if (gptLive && !gptLive.enabled) {
    return (
      <div className="my-auto px-8 py-10 text-center">
        <p className="text-2xs uppercase tracking-wide2 text-zinc-600">
          GPT Live ist in den Einstellungen deaktiviert
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 py-8">
      <button
        type="button"
        onClick={() => void open()}
        disabled={busy}
        className={cx(
          'touchable group relative flex w-full max-w-lg flex-col items-center gap-4',
          'overflow-hidden rounded-[3px] border border-accent/40 px-8 py-9',
        )}
        style={{
          background:
            'linear-gradient(160deg, rgb(var(--accent) / 0.2), rgb(var(--accent) / 0.05) 70%), #0d0d0d',
          boxShadow: '0 0 0 1px rgb(var(--accent) / 0.25), 0 0 50px -16px rgb(var(--accent) / 0.9)',
        }}
      >
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{ background: 'rgb(var(--accent))', boxShadow: '0 0 14px rgb(var(--accent))' }}
        />

        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-accent/40 bg-accent/[0.14] text-accent">
          {busy ? (
            <Loader2 size={30} strokeWidth={1.4} className="animate-spin" />
          ) : (
            <MonitorSmartphone size={30} strokeWidth={1.3} />
          )}
        </span>

        <span className="text-center">
          <span className="block text-[clamp(1.25rem,2.4vw,1.7rem)] font-medium leading-tight text-zinc-50">
            GPT Live öffnen
          </span>
          <span className="mt-2 flex items-center justify-center gap-1.5 text-2xs text-zinc-400">
            <ExternalLink size={13} strokeWidth={1.7} />
            {kiosk ? 'Startet ein eigenes Browserfenster' : 'Öffnet ein neues Browserfenster'}
          </span>
        </span>
      </button>

      {result && (
        <p
          className={cx(
            'max-w-lg text-center text-2xs leading-relaxed',
            result.ok ? 'text-signal-ok/90' : 'text-signal-err/90',
          )}
        >
          {result.message}
        </p>
      )}

      <div className="max-w-lg space-y-2.5">
        <p className="digits text-center text-3xs text-zinc-600">{url}</p>

        {/* Ein einziges Textkind: in einem Flex-Container würde jedes Element
            sonst zu einer eigenen Spalte statt zu fließendem Text. */}
        <div className="flex items-start gap-2.5 rounded-[3px] border border-white/[0.07] bg-white/[0.015] px-3.5 py-3">
          <AlertTriangle size={14} strokeWidth={1.7} className="mt-px shrink-0 text-zinc-600" />
          <p className="text-3xs leading-relaxed text-zinc-500">
            ChatGPT lässt sich nicht in dieses Dashboard einbetten — chatgpt.com verbietet die
            Anzeige in einem Rahmen, und daran führt kein zulässiger Weg vorbei. Deshalb ein
            eigenes Fenster. Für Sprache im Dashboard selbst gibt es den{' '}
            <span className="text-zinc-400">Rubicon Assistant</span> mit dem Mikrofon-Knopf.
          </p>
        </div>
      </div>
    </div>
  );
}
