import type { CSSProperties } from 'react';

export type CardTone = 'teal' | 'sage' | 'peach' | 'terra' | 'navy';

/** The class and the position in the page of a Profile card: its colour, and when it slides in (cards arrive one after the other). */
export function cardProps(tone: CardTone, index: number, extra = ''): { className: string; style: CSSProperties } {
  return { className: `pf-card pf-tone-${tone}${extra ? ` ${extra}` : ''}`, style: { '--pf-i': index } as CSSProperties };
}

/** The letters in the round picture: the first letter of the first two words of a name, counting a letter with its marks as one. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const first = (word: string) => {
    const Segmenter = (Intl as unknown as { Segmenter?: new (locale?: string, options?: { granularity: string }) => { segment: (text: string) => Iterable<{ segment: string }> } }).Segmenter;
    if (Segmenter) for (const part of new Segmenter(undefined, { granularity: 'grapheme' }).segment(word)) return part.segment;
    return Array.from(word)[0] ?? '';
  };
  return words.map(first).join('').toUpperCase();
}
