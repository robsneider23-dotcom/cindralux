import { ListChecks, Plus, StickyNote, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useDashboard } from '@/lib/store';
import { cx } from '@/lib/utils';

type Tab = 'shopping' | 'notes';

/**
 * Einkaufsliste und Notizen.
 *
 * Bewusst schlicht: eine Zeile Text, fertig. Die Einkaufsliste hakt ab statt
 * zu loeschen — erst der eigene "Erledigte loeschen"-Knopf raeumt auf, damit
 * ein versehentliches Antippen nichts verschwinden laesst.
 */
export function ListsPanel() {
  const { lists, reloadLists } = useDashboard();
  const [tab, setTab] = useState<Tab>('shopping');

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="mb-4 flex gap-1.5">
        <TabButton
          active={tab === 'shopping'}
          icon={<ListChecks size={15} strokeWidth={1.7} />}
          label="Einkaufsliste"
          onClick={() => setTab('shopping')}
        />
        <TabButton
          active={tab === 'notes'}
          icon={<StickyNote size={15} strokeWidth={1.7} />}
          label="Notizen"
          onClick={() => setTab('notes')}
        />
      </div>

      {tab === 'shopping' ? (
        <ShoppingList items={lists?.shopping ?? []} onChange={reloadLists} />
      ) : (
        <Notes items={lists?.notes ?? []} onChange={reloadLists} />
      )}
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'touchable flex-1 rounded-[3px] border text-2xs uppercase tracking-wide2',
        active
          ? 'border-accent/50 bg-accent/15 text-accent-soft'
          : 'border-white/[0.08] bg-white/[0.02] text-zinc-400',
      )}
    >
      {icon}
      <span className="ml-2">{label}</span>
    </button>
  );
}

function ShoppingList({
  items,
  onChange,
}: {
  items: NonNullable<ReturnType<typeof useDashboard>['lists']>['shopping'];
  onChange: () => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await api.addShoppingItem({ text: value });
      setText('');
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  const openCount = items.filter((item) => !item.done).length;
  const doneCount = items.length - openCount;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form
        className="mb-3 flex shrink-0 gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="z. B. Milch"
          className="field flex-1"
        />
        <button type="submit" disabled={busy || !text.trim()} className="btn btn-accent px-4">
          <Plus size={17} strokeWidth={2} />
        </button>
      </form>

      {items.length === 0 ? (
        <p className="px-2 py-10 text-center text-2xs uppercase tracking-wide2 text-zinc-600">
          Einkaufsliste ist leer
        </p>
      ) : (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-[3px] border border-white/[0.07] bg-white/[0.015] px-3 py-2.5"
            >
              <button
                type="button"
                onClick={() => void api.toggleShoppingItem(item.id).then(onChange)}
                aria-label={item.done ? 'Als offen markieren' : 'Als erledigt markieren'}
                className={cx(
                  'touchable flex h-6 w-6 min-h-0 shrink-0 items-center justify-center rounded-[2px] border',
                  item.done
                    ? 'border-accent/50 bg-accent/20 text-accent-soft'
                    : 'border-white/[0.15] text-transparent',
                )}
              >
                ✓
              </button>
              <span
                className={cx(
                  'min-w-0 flex-1 truncate text-sm',
                  item.done ? 'text-zinc-600 line-through' : 'text-zinc-100',
                )}
              >
                {item.text}
              </span>
              <button
                type="button"
                onClick={() => void api.deleteShoppingItem(item.id).then(onChange)}
                aria-label="Löschen"
                className="touchable flex h-8 w-8 min-h-0 shrink-0 items-center justify-center rounded-[2px] text-zinc-600 active:text-accent-soft"
              >
                <Trash2 size={15} strokeWidth={1.7} />
              </button>
            </div>
          ))}
        </div>
      )}

      {doneCount > 0 && (
        <button
          type="button"
          onClick={() => void api.clearCheckedShoppingItems().then(onChange)}
          className="mt-3 shrink-0 text-3xs uppercase tracking-wide2 text-zinc-600 active:text-accent-soft"
        >
          {doneCount} erledigt · löschen ({openCount} offen)
        </button>
      )}
    </div>
  );
}

function Notes({
  items,
  onChange,
}: {
  items: NonNullable<ReturnType<typeof useDashboard>['lists']>['notes'];
  onChange: () => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await api.addNote({ text: value });
      setText('');
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form
        className="mb-3 flex shrink-0 gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Notiz eintragen …"
          className="field flex-1"
        />
        <button type="submit" disabled={busy || !text.trim()} className="btn btn-accent px-4">
          <Plus size={17} strokeWidth={2} />
        </button>
      </form>

      {items.length === 0 ? (
        <p className="px-2 py-10 text-center text-2xs uppercase tracking-wide2 text-zinc-600">
          Noch keine Notizen
        </p>
      ) : (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {[...items].reverse().map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-[3px] border border-white/[0.07] bg-white/[0.015] px-3 py-2.5"
            >
              <span className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-zinc-100">
                {item.text}
              </span>
              <button
                type="button"
                onClick={() => void api.deleteNote(item.id).then(onChange)}
                aria-label="Löschen"
                className="touchable flex h-8 w-8 min-h-0 shrink-0 items-center justify-center rounded-[2px] text-zinc-600 active:text-accent-soft"
              >
                <Trash2 size={15} strokeWidth={1.7} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
