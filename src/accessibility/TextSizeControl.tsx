import { useState } from 'react';
import { Type } from 'lucide-react';
import { DEFAULT_TEXT_SIZE_LABELS, readTextSize, writeTextSize } from './textSize';
import type { TextSize, TextSizeLabels } from './textSize';

const SIZES: { value: TextSize; scale: string }[] = [
  { value: 'normal', scale: '0.8rem' },
  { value: 'large', scale: '1rem' },
  { value: 'xlarge', scale: '1.25rem' },
];

/** Three buttons that make all text larger. Remembered on this device. Sits in the sidebar of every role. */
export function TextSizeControl({ labels = DEFAULT_TEXT_SIZE_LABELS }: { labels?: TextSizeLabels }) {
  const [size, setSize] = useState<TextSize>(readTextSize);
  return (
    <div role="group" aria-label={labels.title} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px 8px', color: 'var(--sidebar-text)', fontSize: '0.75rem' }}>
      <Type size={16} aria-hidden="true" />
      <span style={{ flex: 1 }}>{labels.title}</span>
      {SIZES.map(({ value, scale }) => (
        <button
          key={value}
          type="button"
          aria-pressed={size === value}
          aria-label={labels[value]}
          title={labels[value]}
          onClick={() => { setSize(value); writeTextSize(value); }}
          style={{
            minWidth: '32px', height: '32px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 800, fontSize: scale, lineHeight: 1,
            border: '1px solid var(--sidebar-border)', background: size === value ? 'var(--sidebar-active-bg)' : 'transparent',
            color: size === value ? 'var(--forest-dark)' : 'var(--cream-soft)',
          }}
        >
          A
        </button>
      ))}
    </div>
  );
}
