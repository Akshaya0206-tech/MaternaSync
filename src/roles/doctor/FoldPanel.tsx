import { useState } from 'react';
import type { ReactNode } from 'react';
import { Panel } from '../../components/continuity/shared';

/** What a settings card needs to be folded: whether it is open, what to do when it is toggled, and a line to show at its top. */
export interface Fold {
  id: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  note?: ReactNode;
}

const KEY = 'maternasync.fold.';

/** An open/closed choice remembered for this visit only (session storage), so a card the doctor opened stays open while they move around. */
export function useFold(id: string, startOpen = false): [boolean, (open: boolean) => void] {
  const [open, setOpenState] = useState<boolean>(() => {
    try {
      const kept = sessionStorage.getItem(KEY + id);
      return kept === null ? startOpen : kept === '1';
    } catch {
      return startOpen;
    }
  });
  const setOpen = (value: boolean) => {
    setOpenState(value);
    try { sessionStorage.setItem(KEY + id, value ? '1' : '0'); } catch { /* not remembered */ }
  };
  return [open, setOpen];
}

/** A card with the same look as the others whose heading folds it away. It is a native <details>, so it works with the keyboard and a screen reader. */
export function FoldPanel({ id, title, open, onToggle, note, children }: Fold & { title: string; children: ReactNode }) {
  return (
    <details id={id} className="glass-panel continuity-panel assistant-fold" open={open} onToggle={(e) => onToggle(e.currentTarget.open)}>
      <summary><h2>{title}</h2></summary>
      {note}
      {children}
    </details>
  );
}

/** The ordinary card, or the folded one when a `fold` is given. Lets the same settings card live in two places. */
export function PanelOrFold({ title, fold, children }: { title: string; fold?: Fold; children: ReactNode }) {
  return fold ? <FoldPanel {...fold} title={title}>{children}</FoldPanel> : <Panel title={title}>{children}</Panel>;
}
